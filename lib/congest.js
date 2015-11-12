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
		 * Will return false if the iterator has been canceled, otherwise true
		 *
		 * @return Boolean
		 */
		push( data )
		{
			if ( this._canceled )
				return false;
			this._backlog.push( data );
			this._next.resolve( );
			return true;
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
						self._next.promise = promise_try( fn, [ worker ] )
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
