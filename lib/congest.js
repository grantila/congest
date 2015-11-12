'use strict';

var CongestReset = Symbol( );

function implementation( Promise )
{
	function defer( )
	{
		var obj = { };

		obj.promise = new Promise( ( resolve, reject ) => {
			obj.resolve = resolve;
			obj.reject = reject;
		} );

		return obj;
	}

	function promise_try( fn, args )
	{
		args = args || [ ];
		return new Promise( ( resolve, reject ) => {
			try
			{
				Promise.resolve( fn( ...args ) )
				.then( resolve, reject );
			}
			catch ( err )
			{
				reject( err );
			}
		} );
	}

	function _finally( fn )
	{
		return {
			success: function( val )
			{
				return promise_try( fn )
				.then( _ => val );
			},
			fail: function( err )
			{
				return promise_try( fn )
				.then( _ => { throw err; } );
			}
		};
	}

	function forward( defer )
	{
		return {
			success: function( val )
			{
				defer.resolve( val );
				return val;
			},
			fail: function( err )
			{
				defer.reject( err );
				throw err;
			}
		};
	}

	class CongestItem
	{
		constructor( value )
		{
			this.value = value;
			this.defer = defer( );
		}
	}

	class Congest
	{
		constructor( canceler )
		{
			this._canceler = canceler || function( ) { };
			this._backlog  = [ ];
			this._canceled = false;
			this._next     = null;

			this[ CongestReset ]( );
		}

		/**
		 * Push data to this iterator.
		 *
		 * Will return a promise which will be forwarded the result from the
		 * consume function once it has gotten this particular value. This
		 * applies to both if the consume function returned a value or threw
		 * an exception.
		 *
		 * If 'this' is cancelled with 'immediate', values might get thrown
		 * away. If the data to this function is thrown away, the returned
		 * promise is rejected with an Error object with the data in the
		 * property 'value'.
		 *
		 * If this.hasCanceled( ), the returned promise is rejected.
		 *
		 * @return P{Mixed}
		 */
		push( data )
		{
			if ( this._canceled )
				return Promise.reject(
					new Error( "The congest instance has canceled" ) );

			var item = new CongestItem( data );
			this._backlog.push( item );
			this._next.resolve( );

			return item.defer.promise;
		}

		/**
		 * @return Boolean
		 */
		hasCanceled( )
		{
			return this._canceled;
		}

		/**
		 * Register a function which will consume all iterator values.
		 *
		 * If fn throws or returns a promise with an error, the iteration
		 * ends, cancel is called (with immediate as true). This means values
		 * can be lost. If this is not preferred, you must make sure fn does
		 * not fail.
		 *
		 * NOTE; The returned promise from this function is resolve when
		 * iteration has ended.
		 *
		 * @return P{void || first error from (fn)}
		 */
		consume( fn )
		{
			var self = this;
			return new Promise( ( resolve, reject ) => {
				function recurse( )
				{
					var scheduleRecurse = _ => setImmediate( recurse );

					function success( )
					{
						if ( self._backlog.length === 0 )
						{
							if ( self._canceled )
								return resolve( );
							else
							{
								self[ CongestReset ]( );
								return scheduleRecurse( );
							}
						}

						var fin = _finally( scheduleRecurse );
						var worker = self._backlog.shift( );
						var forwardPush = forward( worker.defer );

						self._next.promise = promise_try( fn, [ worker.value ] )
						.then( forwardPush.success, forwardPush.fail )
						.then( fin.success, fin.fail );
					}

					function fail( err )
					{
						var fin = _finally( _ => {
							reject( err );
						} );

						var cancel = self.cancel.bind( self );
						return promise_try( cancel, [ true ] )
						.then( fin.success, fin.fail )
						.catch( err => {
							console.error(
								"[prevents] consume function threw " +
								"exception, followed by the canceler " +
								"throwing:", err.stack );
						} );
					}

					self._next.promise
					.then( success, fail );
				}
				recurse( );
			} );
		}

		/**
		 * Cancels the iterator, will tell upstream to cancel by calling the
		 * canceler function. The return value of the canceler function will
		 * eventually be returned by this function.
		 *
		 * If immediate is truthy, the backlog of values, and potential values
		 * being pushed while canceling will be ignore and lost.
		 * If immediate is falsy (default), all values will be awaited and
		 * iterated.
		 *
		 * @return P{return_type<canceler>}
		 */
		cancel( immediate )
		{
			if ( immediate )
			{
				// Throw away the backlog, but first, reject all their
				// promises.
				this._backlog.forEach( item => {
					var err = new Error( "Congest item was thrown away" );
					err.value = item.value;
					item.defer.reject( err );
				} );

				this._backlog.length = 0;
				this._canceled = true;
				return promise_try( this._canceler );
			}
			else
			{
				var fin = _finally( _ => {
					this._canceled = true;
				} );

				return promise_try( this._canceler )
				.then( fin.success, fin.fail );
			}
		}
	}

	Congest.prototype[ CongestReset ] = function( )
	{
		this._next = defer( );
	}

	Congest.using = Promise => implementation( Promise );

	return Congest;
}

module.exports = implementation( Promise );
