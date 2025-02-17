/**
 * @title WET-BOEW JSON Fetch [ json-fetch ]
 * @overview Load and filter data from a JSON file
 * @license wet-boew.github.io/wet-boew/License-en.html / wet-boew.github.io/wet-boew/Licence-fr.html
 * @author @duboisp
 */
/*global jsonpointer */
( function( $, wb ) {
"use strict";

/*
 * Variable and function definitions.
 * These are global to the plugin - meaning that they will be initialized once per page,
 * not once per instance of plugin on the page. So, this is a good place to define
 * variables that are common to all instances of the plugin on a page.
 */
var $document = wb.doc,
	component = "json-fetch",
	fetchEvent = component + ".wb",
	jsonCache = { },
	jsonCacheBacklog = { },
	completeJsonFetch = function( callerId, refId, response, status, xhr, selector, fetchedOpts ) {
		if ( !window.jsonpointer ) {

			// JSON pointer library is loaded but not executed in memory yet, we need to wait a tick before to continue
			setTimeout( function() {
				completeJsonFetch( callerId, refId, response, status, xhr, selector, fetchedOpts );
			}, 100 );
			return false;
		}
		if ( selector ) {
			try {
				response = jsonpointer.get( response, selector );
			} catch ( ex ) {
				console.error( "JSON fetch - Bad JSON selector: " + selector );
				console.error( response );
				console.error( $( "#" + callerId ).get( 0 ) );
			}
		}
		$( "#" + callerId ).trigger( {
			type: "json-fetched.wb",
			fetch: {
				response: response,
				status: status,
				xhr: xhr,
				refId: refId,
				fetchedOpts: fetchedOpts
			}
		}, this );
	};

// Event binding
$document.on( fetchEvent, function( event ) {

	var caller = event.element || event.target,
		fetchOpts = event.fetch || { url: "" },
		urlParts = fetchOpts.url.split( "#" ),
		url = urlParts[ 0 ],
		fetchNoCache = fetchOpts.nocache,
		fetchNoCacheKey = fetchOpts.nocachekey || wb.cacheBustKey || "wbCacheBust",
		fetchNoCacheValue,
		fetchCacheURL,
		hashPart,
		datasetName,
		selector = urlParts[ 1 ] || false,
		callerId, refId = fetchOpts.refId,
		cachedResponse;

	// Filter out any events triggered by descendants
	if ( caller === event.target || event.currentTarget === event.target ) {

		if ( !caller.id ) {
			caller.id = wb.getId();
		}
		callerId = caller.id;

		if ( selector ) {

			// If a Dataset Name exist let it managed by wb-jsonpatch plugin
			hashPart = selector.split( "/" );
			datasetName = hashPart[ 0 ];

			// A dataset name must start with "[" character, if it is a letter, then follow JSON Schema (to be implemented)
			if ( datasetName.charCodeAt( 0 ) === 91 ) {

				// Let the wb-jsonpatch plugin to manage it
				$( "#" + callerId ).trigger( {
					type: "postpone.wb-jsonmanager",
					postpone: {
						callerId: callerId,
						refId: refId,
						dsname: datasetName,
						selector: selector.substring( datasetName.length )
					}
				} );
				return;
			}
			fetchOpts.url = url;
		}

		if ( fetchNoCache ) {
			if ( fetchNoCache === "nocache" ) {
				fetchNoCacheValue = wb.guid();
			} else {
				fetchNoCacheValue = wb.sessionGUID();
			}
			fetchCacheURL = fetchNoCacheKey + "=" + fetchNoCacheValue;

			if ( url.indexOf( "?" ) !== -1 ) {
				url = url + "&" + fetchCacheURL;
			} else {
				url = url + "?" + fetchCacheURL;
			}
			fetchOpts.url = url;
		}

		Modernizr.load( {
			load: "site!deps/jsonpointer" + wb.getMode() + ".js",
			complete: function() {

				// Ensure this fetch has an URL. There is no URL when only using dataset name (a virtual JSON file).
				if ( !url ) {
					return;
				}

				if ( !fetchOpts.nocache ) {
					cachedResponse = jsonCache[ url ];

					if ( cachedResponse ) {
						completeJsonFetch( callerId, refId, cachedResponse, "success", undefined, selector, fetchOpts );
						return;
					} else {
						if ( !jsonCacheBacklog[ url ] ) {
							jsonCacheBacklog[ url ] = [ ];
						} else {
							jsonCacheBacklog[ url ].push( {
								"callerId": callerId,
								"refId": refId,
								"selector": selector
							} );
							return;
						}
					}
				}

				// Ensure we only receive JSON data and don't allow jsonp
				// jQuery will raise an error if other data format is received
				fetchOpts.dataType = "json";
				if ( fetchOpts.jsonp ) {
					fetchOpts.jsonp = false;
				}

				// Sending Data
				if ( fetchOpts.data ) {
					try {
						fetchOpts.data = ( typeof fetchOpts.data === "string" ? fetchOpts.data : JSON.stringify( fetchOpts.data ) );
					} catch ( err ) {
						throw "JSON fetch - Data being sent to server - " + err;
					}

					fetchOpts.method = fetchOpts.method || "POST";
					fetchOpts.contentType = fetchOpts.contentType || "application/json";
				}

				$.ajax( fetchOpts )
					.done( function( response, status, xhr ) {
						var i, i_len, i_cache, backlog;

						if ( !fetchOpts.nocache ) {
							try {
								jsonCache[ url ] = response;
							} catch ( error ) {
								return;
							}
						}

						completeJsonFetch( callerId, refId, response, status, xhr, selector, fetchOpts );

						if ( jsonCacheBacklog[ url ] ) {
							backlog = jsonCacheBacklog[ url ];

							i_len = backlog.length;

							for ( i = 0; i !== i_len; i += 1 ) {
								i_cache = backlog[ i ];
								completeJsonFetch( i_cache.callerId, i_cache.refId, response, status, xhr, i_cache.selector, fetchOpts );
							}
						}

					} )
					.fail( function( xhr, status, error ) {
						$( "#" + callerId ).trigger( {
							type: "json-failed.wb",
							fetch: {
								xhr: xhr,
								status: status,
								error: error,
								refId: refId,
								fetchOpts: fetchOpts
							}
						}, this );
					}, this );
			}
		} );
	}
} );

} )( jQuery, wb );
