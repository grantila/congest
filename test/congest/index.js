'use strict';

var Promise = require( 'bluebird' );
var Congest = require( '../../' ).using( Promise );

describe( 'general', ( ) => {

	it( 'should be able to perform jobs', ( ) => {
		var congest = new Congest( );

		var result = [ ];

		congest.push( 'a' );
		congest.push( 'b' );

		var onComplete = congest.consume( data => {
			if ( data === 'b' )
				congest.cancel( ); // Graceful, allow all to finish
			result.push( data );
			return Promise.delay( 1 );
		} );

		congest.push( 'c' );
		congest.push( 'd' );

		return onComplete
		.then( _ => {
			expect( result ).to.deep.equal( [ ...'abcd' ] );
		} );
	} );

	it( 'should handle sparse events', ( ) => {
		var congest = new Congest( );

		var result = [ ];

		congest.push( 'a' );
		congest.push( 'b' );

		var onComplete = congest.consume( data => result.push( data ) );

		congest.push( 'c' );
		setTimeout( _ => {
			congest.push( 'd' );
			congest.cancel( );
		}, 5 );

		return onComplete
		.then( _ => {
			expect( result ).to.deep.equal( [ ...'abcd' ] );
		} );
	} );

	it( 'should handle events and cancel before consume', ( ) => {
		var congest = new Congest( );

		var result = [ ];

		congest.push( 'a' );
		congest.push( 'b' );
		congest.cancel( );

		return congest.consume( data => result.push( data ) )
		.then( _ => {
			expect( result ).to.deep.equal( [ ...'ab' ] );
		} );
	} );

	it( 'should handle events and immediate cancel before consume', ( ) => {
		var congest = new Congest( );

		var result = [ ];

		function expectCalled( val )
		{
			return _ => {
				expect( val ).to.equal( true );
			}
		}

		congest.push( 'a' )
		.then( expectCalled( false ), expectCalled( true ) );

		congest.push( 'b' )
		.then( expectCalled( false ), expectCalled( true ) );

		congest.cancel( true );

		return congest.consume( data => result.push( data ) )
		.then( _ => {
			expect( result ).to.deep.equal( [ ] );
		} );
	} );

	it( 'should forward promise result from handler to emitted', ( ) => {
		var congest = new Congest( );

		var result = [ ];
		var awaits = [ ];

		awaits.push(
			congest.push( 'a' )
			.then( _ => {
				expect( result ).to.contain( 'a' );
			} )
		);

		awaits.push(
			congest.push( 'b' )
			.then( _ => {
				expect( result ).to.deep.equal( [ ...'ab' ] );
			} )
		);

		congest.cancel( );

		awaits.push(
			congest.consume( data => {
				result.push( data );
				return result;
			} )
			.then( _ => {
				expect( result ).to.deep.equal( [ ...'ab' ] );
			} )
		);

		return Promise.all( awaits );
	} );

} );
