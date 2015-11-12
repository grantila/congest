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

		congest.push( 'a' );
		congest.push( 'b' );
		congest.cancel( true );

		return congest.consume( data => result.push( data ) )
		.then( _ => {
			expect( result ).to.deep.equal( [ ] );
		} );
	} );

} );
