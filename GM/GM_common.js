/*
   GM specific setup file. To allow for other files in a project to be without GM specific code.
   GM scripts are all packed within one function. `'use strict';` below will be the first directive in it.
   No secondary encapsulation by IIFE needed.
   Variables will have scope shared by all other included files.
 */
'use strict';

////// LOG and DEBUG
// format: LOG|DEBUG[:<level>]
// Value of both could be: undefined/true, LOG could also be a Number, DEBUG a String.
// without <level> value is `true`.
// Both can be set by various means. If LOG/DEBUG is enabled on any place, it will be enabled. String has precedence over "true".
// DEBUG will also turn on LOG.
var LOG, DEBUG;
(function() {
	if (!GM) { // maybe could also check GM_info, but I guess all have GM today
		console.error('GreaseMonkey error. "GM" object not found. Maybe this script was mistakenly included in different environment.');
		return;
	}
	var prevDebug, prevLog;
	if (typeof unsafeWindow !== 'undefined') { prevDebug = unsafeWindow.DEBUG; prevLog = unsafeWindow.LOG;
	} else { prevDebug = window.DEBUG; prevLog = window.LOG; }

	DEBUG = prevDebug || ((GM.info.script.name.indexOf('DEBUG') !== -1 ) ? -1 : false);
	// optional line
	DEBUG = ( GM && GM.info.script.name.split('DEBUG:')[1]?.substring(0,1)) || DEBUG;
	LOG = GM.info.script.name.split('LOG:')[1]?.substring(0,1) || prevLog || DEBUG;
})();
if (DEBUG == 's') { debugger; } /* stop at beginning */ /* eslint-disable-line no-debugger */

/* Usage:
if (DEBUG) {}
if (DEBUG === 's') {}
future: if (DEBUG === 'something') {} It works now from Debug-on-off US, but not from name of current script (code above)
if (LOG) {}
if (LOG == 2) {}
if (LOG >= 2) {}
NOT OK:
if (LOG == 0) {}
if (LOG == 1) {}
 */


////// runWhenPageReady
// usage: runWhenPageReady(init, 'interactive');
// runWhen: [interactive | complete]
//          also accepts aliases: [DOMContentLoaded | load]
var runWhenPageReady = (handler, runWhen = 'complete') => { // eslint-disable-line no-unused-vars
	var runWhenEventName;
	/// aliases
	if (runWhen === 'DOMContentLoaded') { runWhen = 'interactive'; }
	if (runWhen === 'load') { runWhen = 'complete'; }

	if (runWhen !== 'interactive' && runWhen !== 'complete') {
		console.warn('[GM_common] runWhenPageReady(): wrong runWhen argument:', runWhen, '. Defaulting to "complete".');
		runWhen = 'complete';
	}
	if (runWhen === 'interactive') { runWhenEventName = 'DOMContentLoaded'; }
	if (runWhen === 'complete') { runWhenEventName = 'load'; }

	if (document.readyState !== 'complete' && (runWhen === 'complete' || document.readyState !== 'interactive')) {
		window.addEventListener(runWhenEventName, () => runWhenPageReady(handler, runWhen));
		if (LOG) { console.log('[GM_common] runWhenPageReady(): page not ready. Current state:', document.readyState,
				'| desired:', runWhen); }
		return;
	}
	if (LOG) { console.log('[GM_common] runWhenPageReady(): page ready (readyState = "' + runWhen + '")'); }
	handler();
};


////// run once fix
// if GM has @noframes, guard against any and all concurrent run
// TODO: Uncaught (in promise) ReferenceError: Cannot access 'window' before initialization
// todo: what will happen if windows is proxied by GM?
function isIFrame() {
    const realWindow = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
    if (DEBUG) { console.debug('[GM_common]: host: ', realWindow.location.host); }
	try {
        if (realWindow.top !== realWindow.self) {
			if (DEBUG) { console.log('[GM_common]: Running in an iFrame'); }
			return true;
		}
    } catch (e) {
        if (DEBUG) { console.log('[GM_common]: Cross-origin iFrame detected via exception'); }
        return true;
	}
	if (DEBUG) { console.log('[GM_common]: Not running in an iFrame'); }
	return false;
}
// alternative is: switch (window.location.host) { case 'DOMAINNAME': // main page

// when @noframes meta is used, this script must not start in an iFrame
/// GM_info?.script?.options?.noframes is always `null`
// const hasNoFramesMeta = GM_info?.script?.options?.noframes || /^\s*\/\/\s*@noframes\b/m.test(GM_info?.script?.header || '');
const hasNoFramesMeta = /^\s*\/\/\s*@noframes\b/m.test(GM_info?.script?.header || '');
if (hasNoFramesMeta && isIFrame()) {
	// if (DEBUG) { console.error('[GM_common]: Attempted to start in an iFrame'); }
	console.error('[GM_common]: Attempted to start in an iFrame');
	return; /* eslint-disable-line */
}


/*
 * polyfill for GM, to support syntax of some functions from WebExtension
 */
var browser = { /* eslint-disable-line */ /* jshint ignore:line */
	runtime: {
		/*
		 *** browser.runtime.getURL(path)
		 * WebExtension returns string, the fully-qualified URL to the resource within the extension.
		 * e.g. moz-extension://2c127fa4-62c7-7e4f-90e5-472b45eecfdc/beasts/frog.html
		 * Grease Monkey version returns something similar, but Tamper Monkey returns base64 Data URL.
		 * This function will instead of *GM resources* use custom object with resource definitions.
		 * In WebExt, the *path* is: A relative path from the manifest.json to a resource packaged with the extension.
		 * e.g. if the UserScript file is in domain/path/to/userscript/GM/userscript.user.js,
		 * and the resource is in: domain/path/to/userscript/res/some_file.png
		 * the _USERSCRIPT_PATH must be set to '/GM', to find a resource with a relative path "res/some_file.png".
		 * Resources: @resource in meta block are used by a fallback method.
		 */
		_USERSCRIPT_PATH: '/GM', /* if it is in root, value must be '/' */
		_scriptParentPath: null,
		_triedAlternative: [],
		_isResourcefailedListenerRegistered: false,
		_pathMap: {}, // needed for resourcefailed event to know relative path from full path
		_getScriptParentPath: function () {
			if (this._scriptParentPath) { return this._scriptParentPath; }
			this._scriptParentPath = GM.info.script.fileURL.substring(0, GM.info.script.fileURL.lastIndexOf('/GM'));
			return this._scriptParentPath;
		},
		getURL: function (path) {
			if (!path) { throw Error('path is not provided'); }
			if (path.startsWith('http') || path.startsWith('data:')) { return path; }

			// todo: if CSP blocks external resources, this listener should be able to catch it then used fallback
			document.addEventListener('securitypolicyviolation', (e) => {
				console.log('CSP:',e.blockedURI);
				console.log('CSP:',e.violatedDirective);
				console.log('CSP:',e.originalPolicy);
			});

			// listen on event dispatched on failure to load a resource.
			if (!this._isResourcefailedListenerRegistered) {
				document.addEventListener('resourcefailed', async evt => {
					if (this._triedAlternative.includes(evt.target.src)) {
						console.error('[WebExt polyfill] getURL() | Resource failed after retries.', evt.target.src);
						return;
					} else if (LOG) {
						console.log('[WebExt polyfill] getURL() | Resource failed (red error above).', evt.target.src,
								'This is not an error yet, trying a fallback.');
					}
					if (!this._pathMap[evt.target.src]) { console.error('[WebExt polyfill] _getResourceUrl() | resource is not defined in GM meta block', evt.target.src); }
					var altPath = await this._getResourceUrl(this._pathMap[evt.target.src]); // with TM this is Data URL
					// if there is no alternative, don't try anything else
					if (altPath === undefined) { return; }
					this._triedAlternative.push(altPath);
					evt.detail(altPath);
				});
				this._isResourcefailedListenerRegistered = true;
			}
			// For it to work, this listener must be added to each element, e.g. <img>:
			// elImg.addEventListener('error', evt => evt.target.dispatchEvent(new CustomEvent('resourcefailed',
			// 		{bubbles: true, detail: value => elImg.src = value})));

			var fullPath = this._getScriptParentPath() + '/' + path;
			this._pathMap[fullPath] = path;
			return fullPath;
		},
		// copied from my Util class
		_getResourceUrl: async function (resourceName) {
			if (!resourceName) {
				return;
			}
			if (LOG == 5) { console.log('[WebExt polyfill] getResourceUrl() START |', resourceName); }
			var urlRes = await GM.getResourceUrl(resourceName);
			if (!urlRes) {
				console.error('[WebExt polyfill] getResourceUrl() | Resource not physically present:', resourceName);
				return;
			}
			switch (resourceName.substring(resourceName.lastIndexOf('.'))) {
			case '.json': // from: data:application;
				urlRes = 'data:application/json' + urlRes.substring(16);
				break;
			case '.svg': // from: data:application; image/svg+xml
				urlRes = 'data:image/svg+xml' + urlRes.substring(16);
				break;
			case '.ogg': // from: data:application;  it's usually audio, but could be video too.  audio/ogg
				urlRes = 'data:audio/ogg' + urlRes.substring(16);
				break;
			}
			if (LOG == 5) { console.log('[WebExt polyfill] getResourceUrl() url obtained | resourceName:',
					resourceName, '| urlRes:', urlRes.substring(0,40)); }
			return urlRes;
		}
	}
};
