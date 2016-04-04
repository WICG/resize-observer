#### Terminology
Component: a self-contained bundle of HTML, CSS, and JS.

## Why is ResizeObserver needed?

Responsive Web Apps adjust their content to viewport size.
This is often accomplished with CSS and media queries.
Javascript is used when CSS is not expressive enough.
Javascript DOM manipulation stays in sync with viewport size by listening to `window.resize` event.

Responsive Web Apps can be built with components.
These components need to be responsive too.
Unfortunatelly, Web Platform currently does not provide a way for components to keep track of their size.

There is no component counterpart to CSS media queries.
Attempts to design such were unsucessful due to their [inability to deal](http://www.xanthir.com/b4PR0) with circular references.

There is no component counterpart to `window.resize` event either.
ResizeObserver wants to be that counterpart.

ResizeObserver is needed to give components way to respond to changes in size.

As Responsive Web Apps grow in popularity, so will the need for responsive components.

## Current workarounds

There is no way to replicate ResizeObserver functionality on today's Web Platform.

Some apps implement homemade resize notification framework (ex: Polymer).
This approach is error-prone, hard to maintain, and requires every component to implement the homemade method.

Others use [clever hacks](https://github.com/wnr/element-resize-detector) to approximate resize event.
The best hacks all use a similar absolute child trick: insert an absolutely-positioned child into the component,
and craft the child in such a way that it emits a scroll event, or a window.resize when parent's size changes.

None of these approaches are desirable. They fail in correctness, code complexity, and performance.

## Proposed API

The proposed API is an observer-style API. It is modeled after [other](https://www.w3.org/TR/dom/#mutation-observers) DOM [observers](https://github.com/WICG/IntersectionObserver/blob/master/explainer.md).

Providing solution to iframe content height sizing is not a goal.

### Interface

    [Constructor(ResizeObserverCallback callback)]

    interface ResizeObserver {
        void observe(Element target);
        void unobserve(Element target);
        void disconnect();
    };

    callback ResizeObserverCallback = void(sequence<ResizeChangeRecord> changeset);

    interface ResizeChangeRecord {
        Element element;
        double clientWidth;
        double clientHeight;
    };


### Design discussion

#### What triggers a resize notification?

Component authors are interested in size of the content box.
Content box is best represented by clientSize, which includes inner width and padding, but not the scrollBar.

A change in element's clientWidth or clientHeight should trigger a resize notification.

Edge case: what happens if changes to clientSize get reverted before notification fires?
Resize notification may still be fired.
This avoids implementation complexity.

#### What information do notifications contain?

The element, clientWidth, and clientHeight.

Open issue: should notification contain more geomentry information to help developers avoid triggering layout?

#### Why an observer based API, and not events?

Performance: resize notifications can be high frequency. Observer API avoids the overhead of events:

* event capture/bubble
* avoid calling O(n) callbacks for n elements.

Framework authors could provide a developer-friendly 'event-like' based API on top of ResizeObserver to avoid registering too many observers.

#### When are notifications delivered?

Read [WebRenderingPipeline](http://bit.ly/rendering-pipeline) first to understand how the current rendering pipeline works.

The revised pipeline

![The revised pipeline](newpipeline.png)

The new resize notification callbacks fire once per frame after layout. The callbacks necessarily have to run between the Layout and Paint phases. If a layout is forced (e.g. during a setTimeout), then the callbacks do not fire until we run the whole pipeline before putting up a frame. So, for example, this means that a setTimeout will never be able to inject itself between the requestAnimationFrame and the resize observers.

The callbacks themselves can (and will) modify style and tree structure, so we need to run the whole Layout phase in a loop so that changes made during this frame actually get in before the paint. While looping is a little concerning, we already have this pattern in the platform (e.g. MutationObservers, Promises) and it hasn’t caused undue problems. The loop completes when the Notify step doesn’t dirty any style or layout state.

## Error handling

As described, ResizeObserver will keep delivering resize notifications in a single frame, until no more notifications are available.

Each notification handler can manipulate DOM, and trigger further notifications.
This can cause infinite looping, which would be very bad user experience.

To prevent this, the number of times ResizeObserver can be triggered in a single frame will be limited to REPEAT_LIMIT.
If the limit is exceeded, an error task will be queued.
An error object will contain the observer that triggered the error, and its changeset.

TODO: determine the REPEAT_LIMIT

#### Order of notification delivery

When multiple ResizeObservers are registered, notifications should be delivered in order of registration.

Callback changeset should list elements in order of registration.

#### Inline elements

Inline elements should not generate resize notifications.

#### What about transforms?

Transforms do not affect clientSize. They should not trigger notifications.

#### What about animations?

Animations that affect clientSize should trigger notifications.

Developers might want to skip doing work during animation if work is expensive.

#### Resizing and visibility

clientSize becomes 0 when element is invisible.
This will generate a resize notification.
Developers will be able to use ResizeObserver to observe visibility.

## Usage examples (WORK IN PROGRESS, IGNORE)

#### EXAMPLE: [Disqus](https://disqus.com/)

Discuss uses polling.

> The Disqus commenting system is embedded into other sites through an iframe.
When the content inside their iframe changes size they want to be able
to resize the top level iframe and move around elements inside
the iframe as well. Today they do this by periodically polling the
document height, through MutationObservers and requestAnimationFrame,
to detect when things might have changed. What they really want is a
resize listener instead so they can avoid polling and causing
unnecessary synchronous layouts. This has benefits for both battery
life and performance.

```html
    <!-- ResizeObserver works well for this use case -->
    <iframe id="toplevel">
        <div id="content"></div>
    </iframe>
    <script>
        var content = document.getElementById('content');

        var resizeObserver = new ResizeObserver(function handler(changes) {
            for (var i=0; i<changes.length; i++) {
                if (changes[i].element == content) {
                    console.log("resize the top level iframe and move around elements inside the iframe");
                }
            }
        });
        resizeObserver.observe( document.getElementById('content'));
    </script>
```

#### EXAMPLE: [Facebook](https://www.facebook.com/)

Facebook would like to use resize event to optimize friend list loading.

> use case we have right now is inserting a `<div>` that will hold a list of friends who are online in chat. As soon as we insert the `<div>` we want to know it's size so we can plan how many people we should render in the list. Querying the height right away triggers a layout, so we encourage people to do so inside a RAF. This requires cooperation between all RAF users to coordinate queries and modifications to the DOM. I think users of ResizeObserver would find a similar issue if the code triggered by one event modifies the DOM and the code from the next event queries it, a layout is forced.

```javascript
    // ResizeObserver helps: automatically places callback in RAF.
    // geometry information
    var friends = document.createElement('div');
    resizeObserver = new ResizeObserver(function handler(changes) {
        for (var i=0; i<changes.length;i++) {
            if (changes[i] == friends) {
                var howManyFriends = changes[i].clientHeight / 24;
            }
        }
    });
```

#### EXAMPLE: [Polymer.IronResizableBehavior](https://elements.polymer-project.org/elements/iron-resizable-behavior)

Polymer framework implements ad-hoc resize notification

> IronResizableBehavior is a behavior that can be used in Polymer elements to coordinate the flow of resize events between "resizers" (elements that control the size or hidden state of their children) and "resizables" (elements that need to be notified when they are resized or un-hidden by their parents in order to take action on their new measurements).

The entire [Polymer.IronResizableBehavior](https://github.com/PolymerElements/iron-resizable-behavior/blob/master/iron-resizable-behavior.html) can be reimplemented with ResizeObserver.


#### EXAMPLE: [Google Maps API](https://developers.google.com/maps/documentation/javascript/3.exp/reference)

Google Maps API requires developers to notify map when it has been resized

> `resize` event:  Developers should trigger this event on the map when the div changes size: google.maps.event.trigger(map, 'resize') .

By using ResizeObserver internally, Google Maps no longer needs an external 'resize' API.
