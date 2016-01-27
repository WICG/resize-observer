# Resize Observer Explainer

This document outlines an API for observing DOM element's size.

## Who wants to observe size changes?

Common developer pattern is to use javascript to dynamically create and/or position element's children. They do this because:

1. Children's contents are loaded by XHR. Only visible children should be loaded.
2. They are writing a custom layout as CSS is not expressive enough.

These developers are our audience. They want to know when the element's size changes in order to readjust the children.

## Current workarounds

Developers have created two main patterns to replicate ResizeObserver's functionality:

1) Size polling. This is an only option for component developers. They can be resized by host scripts at any time. It is power-inefficient, janky, and a performance hit because querying element's size can trigger layout.

2) Ad-hoc notifications: Javascript that triggers a resize must generate resize notifications. This solution is error-prone, cumbersome to maintain, and only works if developer is in control of the entire
page.

3) Fun one: Very creative solution is exploit window.resize event. Create a iframe inside every resizeable element, and listen to iframe's resize event. Clever, but it costs 0.5Mb per event listener.

[Pattern samples](#common_practice) can be found at the bottom of this document.

None of existing solutions are desirable. They fail in power consumption, code complexity, and perfomance.

## Goal

Create an API to notify developers of element's size changes. Notifications should be delivered when developers need them, with enough information to do fast size calculations. Applications developed with the new API should be performant, and power efficient.

## Proposed API

The proposed API is an observer-style API. It is modeled after [other](https://www.w3.org/TR/dom/#mutation-observers) DOM [observers](https://github.com/WICG/IntersectionObserver/blob/master/explainer.md).

### Interface

    [Constructor(ResizeObserverCallback callback, optional ResizeObserverInit resizeObserverInitDict)]

    interface ResizeObserver {
        void observe(Element target);
        void unobserve(Element target);
        void disconnect();
    };

    dictionary ResizeObserverInit {
        ErrorCallback errorHandler;
    };

    callback ResizeObserverCallback = void(sequence<ResizeChangeRecord> changeset);

    interface ResizeChangeRecord {
       Element element;
       // … What size information do developers need?
    };

    callback ErrorCallback = void(DOMException error, sequence<ResizeChangeRecord> changeset);

### Design discussion

#### Why an observer based API, and not events?

Performance: resize notifications can be high frequency. Observer API avoids the significant overhead of events:

* event capture/bubble
* avoid calling O(n) callbacks for n elements.

Framework authors could provide a developer-friendly 'event-like' based API on top of ResizeObserver to avoid registering too many observers.

#### What triggers a resize notification? (TODO)

Another way of asking the same question is: "What is the Element size developers care about?"

There are many sizes of DOM elements:
- scrollHeight: height of the content area
- clientHeight: The value contains the height with the padding, but it does not include the scrollBar, border, and the margin.
- offsetHeight: height of the visible area
- getBoundingClientRect: affected by rotations

You need to know borderTop, and paddingTop to find contentRect from above measurements.

#### What information do notifications contain?
#### What happens with transforms, animations?
#### Inline elements

The answers to these are dependent on what triggers resize notifications.

#### Resizing and visibility

#### When are notifications delivered?

Read [WebRenderingPipeline](http://bit.ly/rendering-pipeline) first to understand how the current rendering pipeline works.

The revised pipeline

![The revised pipeline](newpipeline.png)

The new resize notification callbacks fire once per frame after layout. The callbacks necessarily have to run between the Layout and Paint phases. If a layout is forced (e.g. during a setTimeout), then the callbacks do not fire until we run the whole pipeline before putting up a frame. So, for example, this means that a setTimeout will never be able to inject itself between the requestAnimationFrame and the resize observers.

The callbacks themselves can (and will) modify style and tree structure, so we need to run the whole Layout phase in a loop so that changes made during this frame actually get in before the paint. While looping is a little concerning, we already have this pattern in the platform (e.g. MutationObservers, Promises) and it hasn’t caused undue problems. The loop completes when the Notify step doesn’t dirty any style or layout state.

#### Dealing with infinite loops

The number of times notification loop will run has to be limited to prevent infinite recursion. If the number of loops exceeds the recurion limit, errorHandler will be called not just for ResizeObservers for the current changeset, for all ResizeObservers that registered error handlers.

All error handlers will be called because it is expected that most developers will not implement the error handler. The idea is that developers that really care will be able to detect errors caused by misbehaving components they are using. For example, framework developers.

Looping can be limited either by number, or as a time limit, or a combination of both. For example, at least 10 loops, or any number in less than 5 * 16ms.

## MutationObserver.takeRecords
Why is MutationObserver.takeRecords there? Performance, ask Tab?

## Usage examples <a name="common_practice">

#### EXAMPLE 1: [Disqus](https://disqus.com/)

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

TODO ResizeAPI usage

#### EXAMPLE 2: [Facebook](https://www.facebook.com/)

Facebook would like to use resize event to optimize friend list loading.

> use case we have right now is inserting a <div> that will hold a list of friends who are online in chat. As soon as we insert the <div> we want to know it's size so we can plan how many people we should render in the list. Querying the height right away triggers a layout, so we encourage people to do so inside a RAF. This requires cooperation between all RAF users to coordinate queries and modifications to the DOM. I think users of ResizeObserver would find a similar issue if the code triggered by one event modifies the DOM and the code from the next event queries it, a layout is forced.

TODO ResizeAPI usage

#### EXAMPLE 3: [Polymer.IronResizableBehavior](https://elements.polymer-project.org/elements/iron-resizable-behavior)

Polymer framework implements ad-hoc resize notification

> IronResizableBehavior is a behavior that can be used in Polymer elements to coordinate the flow of resize events between "resizers" (elements that control the size or hidden state of their children) and "resizables" (elements that need to be notified when they are resized or un-hidden by their parents in order to take action on their new measurements).

TODO ResizeAPI usage

#### EXAMPLE 4: [Google Maps API](https://developers.google.com/maps/documentation/javascript/3.exp/reference)

Google Maps API requires developers to notify map when it has been resized

> `resize` event:  Developers should trigger this event on the map when the div changes size: google.maps.event.trigger(map, 'resize') .

TODO ResizeAPI usage

#### EXAMPLE 5: An infinite scroller

TODO



