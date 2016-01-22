# Resize Observer Explainer

## What is this?

This document outlines an API that can be used to observe changes to DOM element's width and height.

## Why?

Web developers want to know when DOM element's size changes. Common reasons are:

* An element implements custom layout of its children
* Infinite scroller needs to adjust its viewport
* Canvas chart element would like to paint a pie proportional to canvas size

In the absence of an API, developers have created imperfect workarounds:

1) If they control the entire page, they can tell which code might trigger a resize. This solution is error-prone, and cumbersome to maintain.
2) If they are a component, they have to poll for sizes. This is power-inefficient, and janky.

The need for this API will increase with Web Components, because they can only poll.

# Goals

The goal of the API is simple: provide notification when element's `offsetWidth/offsetHeight` change.

# Interface

    [Constructor(ResizeObserverCallback callback, ResizeObserverInit options)]

    interface ResizeObserver {
        void observe(Element target);
        void disconnect();
    };

    callback ResizeObserverCallback = void (sequence<ResizeChangeRecord> changes);

    dictionary ResizeObserverInit {
      // … ??
    };

    interface ResizeChangeRecord {
       Element element;
       // … ??
    };


# Today's examples

## EXAMPLE 1: [Disqus](https://disqus.com/)

 The Disqus commenting system is embedded into other sites through an iframe. When the content inside their iframe changes size they want to be able to resize the top level iframe and move around elements inside the iframe as well. Today they do this by periodically polling the document height, through MutationObservers and requestAnimationFrame, to detect when things might have changed. What they really want is a resize listener instead so they can avoid polling and causing unnecessary synchronous layouts. This has benefits for both battery life and performance.

