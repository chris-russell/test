/*

	The base JS for the framework.
	
	Written to do dependency injection requirejs style.
	
	The build process will make the dependency injections
	go inline to the script so that it can be built
	into a single file.
	
	The reason that this is built custom is so that as the
	framework expands, the individual components can be built
	inheriting from the base pso components. Then, those files
	can be built to a flat, built file as well, with it's only
	external dependency being the framework itself.
	
	It will need to be tested with requirejs and other dependency
	injection systems to make sure that the built files work as
	AMD loaded components when needed by the final team.

*/

var pso = (function($){
	'use strict';
	
	var methods = {
		define : function(name, dependencies, module){
			/*
				This is the main define function of the UX framework.
				In this function, defined components are parsed for
				dependencies and passed back into the framework within
				a private object, keyed by the file name. This way, they
				can be accessed as javascript objects and grabbed for
				consumption by the resultant script.
			*/
			console.log("pso_widget_base.js : widget instantiated via pso.define - "+name)
			var args = new Array(),
				stopped = false,
				loaded = new Array()
				
			priv.loading = 0 //set loading to 0
							
			if(typeof dependencies == "function"){
				//there's no dependencies, remap the vars
				module = dependencies
				dependencies = null
			}
			
			//map the current module to the global dependencies
			if(!priv.deps[name]){
				priv.deps[name] = module
			}
			
			if(dependencies == null){
				runIt(null)
			}
			else {
				//set up an ajax stop here
				/*$(document).ajaxStop(function(){
					stopped = true //set this for true, so that it can be tracked later on
					last(dependencies.length - 1)
				})*/
				//first, iterate through the dependencies and get the associated files
				var loading = 0
				
				for(var key in dependencies){
					var file = dependencies[key]
					
					loaded.push(0)
					
					if(file.indexOf(".html") != -1){
						loadDeps(file, key, "getHtml", loading)
					}
					else if(file.indexOf("nls") != -1){
						loadDeps(file, key, "getNls", loading)
					}
					else if(file.indexOf(".js") != -1){
						loadDeps(file, key, "getJs", loading)
					}
					else {
						//catch all else and just get it with the auto typing of the HTML call
						loadDeps(file, key, "getHtml", loading)
					}
				}
			}
			
			function loadDeps(file, key, type, loading){
				if(!priv.deps[file]){
					//its not loaded, so bring it in via ajax
					priv[type](file, key, loading, function(data, i, load){
						loadHandler(data, i, file, load)
					})
				}
				else {
					//its already loaded, just handle it
					loadHandler(priv.deps[file], key, file)
				}
			}
			
			function loadHandler(data, i, file, loading){
				args[i] = data //use this format to retain order after async call
				
				//push a 1 to the array that indicates it's been loaded
				loaded[i] = 1
													
				last(i, file, loading)
			}
			
			function last(i, file, loading){
				var isLoaded = checkLoaded()
				//if it's the last dependency, then fire the script
				if((isLoaded === true && loading === 0) || (isLoaded === true && loading === 0 && i == dependencies.length - 1)){
					runIt(args)
				}
			}
			
			function runIt(args){
				//run apply against the module, passing the args array back in
				if(typeof module() == "object"){
					var modWolf = module.apply(null, args)
					//if it's got an init, then run the initialize
					if(modWolf.init){
						modWolf.init()
					}
				}
				else {
					module.apply(null, args)
				}
			}
			
			function checkLoaded(){
				var isLoaded = true
				
				for(var key in loaded){
					if(loaded[key] === 0){
						isLoaded = false
					}
				}
				
				return isLoaded
			}
		},
		
		parseTemplate : function(struct, scope){
			console.log("pso_widget_base.js : parsing a template structure")
			//format the struct
			var newStruct = priv.format(struct, scope)
			//return the struct
			return newStruct
		},
		
		initialize : function(){
			// set up the message listener here, needs to be done for widgets and pages
			$(window).on("message", subpub.messageHandler)
			
			// assign an id here, and if it's a widget, then let it be overwritten by the passed in id later
			this.id = subpub.genUuid()
			
			// todo - possibly put a mutation observer in here to watch
			// the DOM and respond to hide events with a stop request to any hidden widgets
		},
		
		initializeWidget : function(scope, callback){
			// run anything here that's needed to initialize the widget
			pso.initialize()
			
			// set up the id here since it's a widget
			// get this from the url params
			var params = subpub.deserializeParams(window.location.search)
			
			// check to see if the params were posted in the url
			var size = 0
			for(var key in params){
				if(params.hasOwnProperty(key)) size++
			}
			if(size > 0){
				// okay, assume the params are passed in here, so just go for it
				scope.params = params
				// callback - bind to the scope
				var newCallback = callback.bind(scope)
				newCallback()
			}
			else {
				// post a request to the subpub mechanism to get the params
				pso.request(window.parent, "params", null, function(e){
					var msg = e.originalEvent.data
					// params back here, set them up
					scope.params = msg.payload.message
					// callback - bind to the scope
					var newCallback = callback.bind(scope)
					newCallback()
				})
			}
			
			// set up any event listeners here and allow passing up to the parent window
			$(document).on({
				mousedown : subpub.passEvent,
				//mousemove : subpub.passEvent, // this seems excessive, might cause too much messaging
				mouseup : subpub.passEvent,
				click : subpub.passEvent,
				touchstart : subpub.passEvent,
				touchmove : subpub.passEvent,
				touchend : subpub.passEvent,
				keyup : subpub.passEvent,
				keydown : subpub.passEvent,
				keypress : subpub.passEvent
			})
		},
		
		serializeParams : function(parentEl){
			// serialize the received params
			var params = {}

			console.log("pso_widget_base.js : serializing parameters")

			//it's an object tag, get them from param
			parentEl.parent().children("input[type='hidden']").each(function(i, item){
				item = $(item)
				var value = item.attr("value"), // the value
					isJson = priv.isJsonString(value)
				if(isJson === true){
					value = JSON.parse(value)
				}
				
				if(typeof value == "object"){
					for(var key in value){
						value[key] = decodeURI(value[key])
					}
				}
				else if(typeof value != "boolean") {
					value = decodeURI(value)
				}
				
				params[item.attr("name")] = value
			})

			return params
		},
		
		// sub-pub mechanisms here
		Message : function(method, topic, message, bubbles, originalEvent){
			// this is a constructor, so when it's invoked as "new" this will refer 
			// only to the created object, not the whole PSO object
			this.type = "message"
			this.method = method
			this.bubbles = bubbles ? bubbles : true // bubbles defaults to true
			this.timestamp = new Date().getTime() // date string
			
			// make the payload
			this.payload = {}
			this.payload.topic = topic
			this.payload.id = pso.id
			if(message) this.payload.message = message
			if(originalEvent){
				this.payload.originalEvent = {}
				// this is throwing an error here on transfer, might need to clone the properties?
				for(var key in originalEvent){
					var item = originalEvent[key]
					if(key == "clientX" || key == "clientY" || key == "charCode" || key == "keyCode" || key == "pageX" || key == "pageY" || key == "screenX" || key == "screenY" || key == "offsetX" || key == "offsetY" || key == "type" || key == "bubbles"){
						// selectively rebuild the event to prevent circular logic
						this.payload.originalEvent[key] = item
					}
				}
			}
		},		
		
		subscriptions : {}, //object to store the subscriptions per window
		
		subscribers : {}, //object to store the subscribers to broadcast to
		
		requests : {}, //request objects stored until done
		
		subscribe : function(target, topic, handler){
			// subscribe to messages on certain topics
			// post a message to the parent requesting a subscription
			// so the parent knows to send messages to this window
			var payload = new pso.Message("subscribe", topic)
			target.postMessage(payload, "*")
			
			// also list the subscription in the subscriptions object
			// to be referenced on receipt to fire the handler
			pso.subscriptions[topic] = handler
		},
		
		unsubscribe : function(target, topic){
			// unsubscribe from it
			var payload = new pso.Message("unsubscribe", topic)
			target.postMessage(payload, "*")
			delete pso.subscriptions[topic]
		},
				
		publish : function(topic, message, bubbles){
			// publish messages to listeners
			var payload = new pso.Message("publish", topic, message, bubbles)
			// loop through all subscribers and post a message
			if(pso.subscribers[topic]){
				for(var key in pso.subscribers[topic].subscribers){
					var source = pso.subscribers[topic].subscribers[key].source
					source.postMessage(payload, "*")
				}
			}
		},
		
		request : function(target, topic, message, handler){
			var payload = new pso.Message("request", topic, message)
			target.postMessage(payload, "*")
			
			// store the request and handler to get fired in response
			if(handler) pso.requests[topic] = handler
		},
		
		respond : function(target, topic, message){
			var payload = new pso.Message("response", topic, message)
			target.postMessage(payload, "*")
		}
	}
	
	// the internal methods for subpub
	var subpub = {
		messageHandler : function(e){
			// respond to messages here
			if(e.data == undefined) e.data = e.originalEvent.data
			// check to see if it's a string, then parse it (to support older systems that use JSON (SPP))
			if(typeof e.data == "string") e.data = JSON.parse(e.data)
			// get the topic, then fire the position in
			// descriptions that holds the handler
			switch(e.data.method) {
				case "subscribe" :
					subpub.subscriptionHandler(e)
					break
				case "unsubscribe" :
					subpub.unsubscribeHandler(e)
					break
				case "publish" :
					subpub.publishHandler(e)
					break
				case "request" :
					subpub.requestHandler(e)
					break
				case "response" :
					pso.requests[e.data.payload.topic](e)
					// now take it out of the requests object
					delete pso.requests[e.data.payload.topic]
					break
			}
			
		},
		subscriptionHandler : function(e){
			var source = e.source ? e.source : e.originalEvent.source
			// someone is asking to subscribe, handle it here on the receiver side
			if(!pso.subscribers[e.data.payload.topic]){
				pso.subscribers[e.data.payload.topic] = {
					subscribers : {}
				}
			}
			// push the subscriber into the subscribers array for that topic
			pso.subscribers[e.data.payload.topic].subscribers[e.data.payload.id] = {
				source : source
			}
		},
		unsubscribeHandler: function(e){
			delete pso.subscribers[e.data.payload.topic].subscribers[e.data.payload.id]
			// if there are no more subscribers, delete the whole topic
			var size = 0
			for(var key in pso.subscribers[e.data.payload.topic].subscribers){
				if(pso.subscribers[e.data.payload.topic].subscribers.hasOwnProperty(key)) size++
			}
			if(size === 0) delete pso.subscribers[e.data.payload.topic]
		},
		publishHandler : function(e){
		    var topic = e.data.payload.topic
		    
		    // if it's an event that bubbles, then bubble it up automatically
		    if(e.data.payload.topic == "event" && e.data.payload.originalEvent.bubbles){
				this.passEvent(e.data.payload.originalEvent)
			}
		    
			// fire off the local handler here
			if(pso.subscriptions[topic]) pso.subscriptions[topic](e)
			
			// it should also be re-broadcast here to all other subscribers
			if(pso.subscribers[topic]){
				for(var key in pso.subscribers[topic].subscribers){
					var source = pso.subscribers[topic].subscribers[key].source
					source.postMessage(e.data, "*")
				}
			}
			
		},
		requestHandler : function(e){
			// if it's a param request, take care of it and send the response
			switch(e.data.payload.topic){
				case "params" :
					var params = pso.serializeParams($(subpub.getObject(e.originalEvent.source)))
					pso.respond(e.originalEvent.source, e.data.payload.topic, params)
					break
				case "setheight" :
					// use Ravi's method to get the page object, vs this one (less fragile)
					var object = subpub.getObject(e.originalEvent.source)                    
					$(object).css("height", e.data.payload.message+"px")
					break
				case "navigate" :
				    var target = e.data.payload.message
				    window.location.href = target
				    break
				case "scrollEnabled" : 
				    // this needs to be more intelligent... it just assumes
				    // that if the framework is in place then it's tru
				    pso.respond(e.originalEvent.source, e.data.payload.topic, true)
				    break
				default :
					// not params - need a mechanism here to respond to requests
			}
		},
		passEvent : function(e){
			if(e.bubbles){
				if(window.parent != window){
					var msg = new pso.Message("publish", "event", null, e.bubbles, e)
					window.parent.postMessage(msg, "*")
				}
			}
		},
		deserializeParams : function(p){
		    // strip out %20 from the URL
		    p = p.replace(/\%20/g, "")
			var ret = {},
				seg = p.replace(/^\?/,'').split('&'),
				len = seg.length, i = 0, s;
			for (;i<len;i++) {
				if (!seg[i]) { continue; }
				s = seg[i].split('=');
				ret[s[0]] = s[1];
			}
			return ret
		},
		genUuid : function(){
			var d = new Date().getTime()
		    var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		        var r = (d + Math.random() * 16) % 16 | 0
		        d = Math.floor(d / 16)
		        return (c == "x" ? r : (r & 0x7 | 0x8)).toString(16)
		    })
		    return uuid
		},
		getObject : function(win){
		    var object = {},
			    iframesOnPage = document.querySelectorAll('iframe'),
			    objectsOnPage = document.querySelectorAll('object')
            for (var i = 0; i < iframesOnPage.length; i++){
                if(win === iframesOnPage[i].contentWindow) object = iframesOnPage[i];
            }
            for (var i = 0; i < objectsOnPage.length; i++){
                var object = objectsOnPage[i]
                if(win === objectsOnPage[i].contentWindow) object = objectsOnPage[i];
            }
			return object
		}
	}
	
	//the internal methods for templating and loading
	var priv = {
		getHtml : function(file, key, loading, callback){
			console.log("pso_widget_base.js : load an HTML/generic dependency in")
			loading += 1
			$.ajax({
				url : file,
				method : "GET"
			}).done(function(data){
				loading -= 1
				callback(data, key, loading)
			})
		},
		getJs : function(file, key, loading, callback){
			console.log("pso_widget_base.js : load JS dependency in")
			loading += 1
			$.ajax({
				url : file,
				method : "GET",
				dataType : "script"
			}).done(function(data){
				var name = priv.getName(data)
				loading -= 1
				callback(priv.deps[name](), key, loading)
			})
		},
		getNls : function(file, key, loading, callback){
			console.log("pso_widget_base.js : load NLS dependency in")
			loading += 1
			
			var lang = !navigator.language ? navigator.userLanguage : navigator.language			
			
			$.ajax({
				url : file,
				method : "GET",
				dataType : "script"
			}).done(function(data){
				//check the script and see if it supports the language				
				var name = priv.getName(data),
					lang2 = lang.substring(0, 2) //check it it's the full string or just the basic lang
				if (priv.deps[name]()[lang] === true){
					//change the language
					var newUrl = file.split("/")
					file = newUrl[0]+"/"+newUrl[1]+"/"+newUrl[2]+"/"+lang+"/"+newUrl[3]
					priv.loadNewLang(file, key, loading, callback)
				}
				else if (priv.deps[name]()[lang2] === true){
					//change the language
					var newUrl = file.split("/")
					file = newUrl[0]+"/"+newUrl[1]+"/"+newUrl[2]+"/"+lang2+"/"+newUrl[3]
					priv.loadNewLang(file, key, loading, callback)
				}
				else {
					loading -= 1
					callback(priv.deps[name](), key, loading)
				}				
			})
		},
		loadNewLang : function(file, key, loading, callback){
			//load a new language in, to replace the old one
			$.ajax({
				url : file,
				method : "GET",
				dataType : "script"
			}).done(function(data){
				var name = priv.getName(data)
				loading -= 1
				callback(priv.deps[name](), key, loading)
			})
		},
		getName : function(src){
			var name = ""
			
			src = priv.cleanComments(src)
			src = src.split("(")
			src = src[1].split(",")
			name = src[0].replace(/[\t\s\"\']/g, "")
			
			return name
		},
		cleanComments : function(src){
			while(src.indexOf("//") !== -1){
				var pos1 = src.search('//'),
					pos2 = src.search(/\n/),
					diff = pos2 - pos1,
					comment = src.substr(pos1, diff)
				src = src.replace(comment, "")
				src = src.replace(/\n/, "")
			}
			while(src.indexOf("/*") !== -1){
				var pos1 = src.search("/*"),
					pos2 = src.search(/\*\//) + 2,
					diff = pos2 - pos1,
					comment = src.substr(pos1, diff)
				src = src.replace(comment, "")
			}
			
			return src
		},
		deps : {},
		format: function(struct, scope){
			//run it through the templater first
			struct = priv.template(struct, scope)
			//parse it into HTML nodes
			struct = $.parseHTML(struct)
			//now do the click handlers, after it's parsed
			struct = priv.handlers(struct, scope)
			//return the struct string
			return struct
		},
		template : function(struct, scope){
			console.log("pso_widget_base.js : running the templating engine")
			// this is a customized version of the underscore library templating
			// JavaScript micro-templating, similar to John Resig's implementation.
			// Templating uses {{ handlebar }} delimiters, preserves whitespace,
			// and correctly escapes quotes within interpolated code.
			if(typeof struct == "function"){
				struct = struct()
			}
			var render,
				noMatch = /(.)^/,
				escapes = {
					"'":	  "'",
					'\\':	  '\\',
					'\r':	  'r',
					'\n':	  'n',
					'\t':	  't',
					'\u2028': 'u2028',
					'\u2029': 'u2029'
				},
				escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g,
				settings = {
					evaluate : /\{\{([\s\S]+?)\}\}/g,
					interpolate : /\{\{=([\s\S]+?)\}\}/g,
					escape : /\{\{-([\s\S]+?)\}\}/g
				},
				matcher = new RegExp([ // Combine delimiters into one regular expression via alternation.
					(settings.escape || noMatch).source,
					(settings.interpolate || noMatch).source,
					(settings.evaluate || noMatch).source
				].join('|') + '|$', 'g')

			// Compile the template source, escaping string literals appropriately.
			var index = 0
			var source = "__p+='"
			struct.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
				source += struct.slice(index, offset)
				.replace(escaper, function(match) { return '\\' + escapes[match]; })

				if (escape) {
					source += "'+\n((__t=(" + escape + "))==null?'':escape(__t))+\n'"
				}
				if (interpolate) {
					source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'"
				}
				if (evaluate) {
					source += "';\n" + evaluate + "\n__p+='"
				}
				index = offset + match.length
				
				return match
			})
			
			source += "';\n"

			// If a variable is not specified, place data values in local scope.
			if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n'

			source = "var __t,__p='',__j=Array.prototype.join," +
				"print=function(){__p+=__j.call(arguments,'');};\n" +
				source + "return __p;\n"

			try {
				render = new Function(settings.variable || 'obj', 'pso', source)
			} catch(e) {
				e.source = source
				throw e
			}

			if (scope) return render(scope)
			
			var template = function(scope) {
				return render.call(this, scope)
			}

			// Provide the compiled function source as a convenience for precompilation.
			template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}'

			return template
		},
		handlers: function(struct, scope){
			console.log("pso_widget_base.js : attaching the event handlers")
			var struct = $(struct) // jquerify it
			
			// click handlers
			if($(struct).find("[data-click]").length > 0){
				$(struct).find("[data-click]").each(function(i, item){
					var type = "click"
					priv.eventHandler(item, type, scope)
				})
			}
			if($(struct).find("[data-mousedown]").length > 0){
				$(struct).find("[data-mousedown]").each(function(i, item){
					var type = "mousedown"
					priv.eventHandler(item, type, scope)
				})
			}
			if($(struct).find("[data-mouseup]").length > 0){
				$(struct).find("[data-mouseup]").each(function(i, item){
					var type = "mouseup"
					priv.eventHandler(item, type, scope)
				})
			}
			
			// touch handlers
			if($(struct).find("[data-touchstart]").length > 0){
				$(struct).find("[data-touchstart]").each(function(i, item){
					var type = "touchstart"
					priv.eventHandler(item, type, scope)
				})
			}
			if($(struct).find("[data-touchmove]").length > 0){
				$(struct).find("[data-touchmove]").each(function(i, item){
					var type = "touchmove"
					priv.eventHandler(item, type, scope)
				})
			}
			if($(struct).find("[data-touchend]").length > 0){
				$(struct).find("[data-touchend]").each(function(i, item){
					var type = "touchend"
					priv.eventHandler(item, type, scope)
				})
			}
			
			// submit handlers
			if($(struct).find("[data-submit]").length > 0){
				$(struct).find("[data-submit]").each(function(i, item){
					var type = "submit"
					priv.eventHandler(item, type, scope)
				})
			}
			
			// change handler
			if($(struct).find("[data-change]").length > 0){
				$(struct).find("[data-change]").each(function(i, item){
					var type = "change"
					priv.eventHandler(item, type, scope)
				})
			}
			
			// focus handlers
			if($(struct).find("[data-focus]").length > 0){
				$(struct).find("[data-focus]").each(function(i, item){
					var type = "focus"
					priv.eventHandler(item, type, scope)
				})
			}
			if($(struct).find("[data-blur]").length > 0){
				$(struct).find("[data-blur]").each(function(i, item){
					var type = "blur"
					priv.eventHandler(item, type, scope)
				})
			}
			
			// key handlers
			if($(struct).find("[data-keypress]").length > 0){
				$(struct).find("[data-keypress]").each(function(i, item){
					var type = "keypress"
					priv.eventHandler(item, type, scope)
				})
			}
			if($(struct).find("[data-keyup]").length > 0){
				$(struct).find("[data-keyup]").each(function(i, item){
					var type = "keyup"
					priv.eventHandler(item, type, scope)
				})
			}
			if($(struct).find("[data-keydown]").length > 0){
				$(struct).find("[data-keydown]").each(function(i, item){
					var type = "keydown"
					priv.eventHandler(item, type, scope)
				})
			}
			
			return struct
		},
		eventHandler : function(item, type, scope) {
			var funk = $(item).attr("data-"+type)
			$(item).on(type+".pso", function(e){
			    console.log("widget API handler firing")
				// analytics  hooks can go here, so each event registered
				// is pushed out as a data-point
				// would require auth.session to push the user out
				if(typeof scope[funk] == "function"){
    				var returned = scope[funk].bind(scope)
					returned(e)
				}
				else {
					console.error("pso_widget_base.js error : data-"+type+" only accepts functions as arguments", type)
				}
			})
		},
		escapeChars: function(text){
		  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
		},
		isJsonString : function(str) {
		    try {
		        JSON.parse(str);
		    } catch (e) {
		        return false;
		    }
		    return true;
		}
	}
	
	// self initialize
	!function(){
	    methods.initialize()
	}()
	
	return methods
})(window.jQuery)
