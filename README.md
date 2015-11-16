# congest

Pipelining of events to an event handler by respecting the handlers promise result indicating when to dispatch the next event.

A lot of event-based code looks like this:

```js
dispatcher.on( 'my-event', ( data ) => {
	doStuff( )
	.then( doMore )
	.then( doLastThing );
} );
```

This is all fine as long as the work being done is totally isolated between events, such as for web server requests (ideally).

However, when the handler is using any shared state or resource, this can cause non-deterministic side-effects when event handler for event 1 is working on `doMore` when event 2 arrives, causing `doStuff` to be invoked. This can typically happen in UI code (with the UI resources, e.g. the DOM, being shared) or internally in a code flow for various reasons.

This is when `congest` comes in handy. Congest will invoke your handler function and respect the returned promise and await it, before invoking it again when the next event arrives.

## API

The library is written using ES6 and if run in node.js, requires version 5.

### Promises

`congest` uses the native `Promise` unless you choose to use a specific one:

```js
var Congest = require( 'congest' );
// or using e.g. Bluebird
var Congest = require( 'congest' ).using( require( 'bluebird' ) );
```

### The Congest class

The returned value from `require( 'congest' )` or `require( 'congest' ).using( Promise )` is a class called Congest. It is constructed with an optional canceler callback which will be invoked when the congest instance is canceled (described below).

Example:
```js
var congest = new Congest( [ cancelUpstream ] );

P{void} congest.push( value ); // Call this for each event

P{void} congest.cancel( [ immediate ] ); // Cancels the Congest instance

P{void} congest.consume( Function );

Boolean congest.hasCanceled( ); // Boolean
```

#### Push

The `P{void} push( value )` function is used to add values to the congest instance. The consume function will be invoked sequencially with these values. The returned promise can be used to await when the consume function has completed this particular value. This is useful e.g. when using `congest` to handle incoming AMQP messages that are supposed to be ack'd or nack'd (e.g. depending on the promise result).

#### Cancel

To cancel the congest instance, so no more pushes are allowed, the `P{void} cancel( Boolean immediate = false )` function should be called. By default the optional `immediate` argument is false, which means `congest` will gracefully cancel, await the custom canceler to complete, and then consume the backlog of values until we are done. If `immediate` is truthy, the congest instance will guarantee that the consume function will not be called again. The backlog of values will be ignored and deleted, i.e. data will be lost.

The returned promise will be completed when the last consume function has finished and completed (hence only really useful when `immediate` is false).

#### Consume

Register a function to be called for each pushed value. When `push( value )` is called, the registered function will be called with `value`, but if this function returns a promise, it will be awaited before the function is called again next time. That's the whole point of this library.

If this function throws an error or returns a rejected promise, the congest instance will cancel and you will lose the rest of the values. The error will then be forwarded to the returned promise.

The returned promise will (unless an error occurs), be resolved when the last value has been completely taken care of, i.e. when the congest instance has been canceled and the last consume function has been invoked and completed.

#### Custom canceler

The custom canceler provided to the constructor will, if used, be called when `cancel( )` is invoked, and it will be awaited before actually marking the Congest instance to be canceled. This is useful to allow an upstream resource to stop sending events, and await an acknowledgement from this resource. This is typically the case with consuming messages from AMQP queues, where you need to wait for acknowledgement before you can actually prevent more data to be emitted to `push( )`.
