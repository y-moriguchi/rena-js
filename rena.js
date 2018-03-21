/**
 * rena.js
 *
 * Copyright (c) 2018 Yuichiro MORIGUCHI
 *
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 **/
(function(root) {
	var actions = [],
		actionId = 1,
		RenaModule,
		undef = void 0,
		i;
	function isArray(arg) {
		return Object.prototype.toString.call(arg) === '[object Array]';
	}
	function nvf(old, value) {
		return (value === undef || value === null) ? old : value;
	}
	/**
	 * Keyword store using trie tree.
	 * @constructor
	 */
	function Trie(keywords) {
		var i,
			j,
			trie,
			ch;
		this._trie = {};
		for(i = 0; i < keywords.length; i++) {
			trie = this._trie;
			for(j = 0; j < keywords[i].length; j++) {
				ch = keywords[i].charAt(j);
				if(!trie[ch]) {
					trie[ch] = {};
				}
				trie = trie[ch];
			}
		}
	}
	Trie.prototype = {
		/**
		 * searches a keyword.
		 * @param {String} str a string to be searched
		 * @param {Number} index an index to be searched
		 * @return {Object} matched string and last index
		 */
		search: function(str, index) {
			var trie = this._trie,
				i,
				ch,
				res = "";
			for(i = index; i < str.length; i++) {
				ch = str.charAt(i);
				if(trie[ch]) {
					trie = trie[ch];
					res += ch;
				} else {
					break;
				}
			}
			return {
				match: res,
				lastIndex: i
			};
		}
	};
	/*
	 * a function which creates Rena module.
	 */
	function RenaFactory() {
		/*
		 * transform the given object to searchable function.
		 */
		function wrap(pattern) {
			var regex,
				reSource,
				reFlags = "g";
			if(typeof pattern === "string") {
				return function(str, index) {
					if(str.substr(index, pattern.length) === pattern) {
						return {
							match: pattern,
							lastIndex: index + pattern.length
						};
					} else {
						return null;
					}
				};
			} else if(pattern instanceof RegExp) {
				reSource = pattern.source;
				reFlags += pattern.ignoreCase ? "i" : "";
				reFlags += pattern.multiline ? "m" : "";
				regex = new RegExp(reSource, reFlags);
				return function(str, index) {
					var match;
					regex.lastIndex = 0;
					if(!!(match = regex.exec(str.substr(index))) && match.index === 0) {
						return {
							match: match[0],
							lastIndex: index + regex.lastIndex,
							extra: match
						};
					} else {
						return null;
					}
				};
			} else if(pattern instanceof Rena) {
				return function(str, index, attr) {
					return pattern.parseStart(str, index, attr);
				};
			} else if(typeof pattern === "function") {
				return pattern;
			} else {
				throw new Error("Unsupported Type");
			}
		}
		/*
		 * an instruction of new action
		 */
		function NewAction(action) {
			actions[actionId] = action;
			this.action = actionId++;
		}
		/*
		 * a repetation instruction
		 */
		function Repeat(action, init, addr, minimum) {
			this.action = action;
			this.init = init;
			this.addr = addr;
			this.minimum = minimum;
		}
		/*
		 * an instruction of alternation
		 */
		function Alt(action, alternates) {
			this.action = action;
			this.alternates = alternates;
		}
		/*
		 * an instruction of control flow
		 */
		function GoTo(action, addr, maximum) {
			this.action = action;
			this.addr = addr;
			this.maximum = maximum;
		}
		/*
		 * an instruction of simple match
		 */
		function Then(pattern, action, actionId) {
			this.pattern = wrap(pattern);
			this.action = action;
			this.actionId = actionId;
		}
		/*
		 * an instruction of lookaehad
		 */
		function Lookahead(pattern, positive) {
			this.pattern = wrap(pattern);
			this.positive = positive;
		}
		/*
		 * an instruction of condition
		 */
		function Cond(cond) {
			this.cond = cond;
		}
		/*
		 * an instruction of passing all actions after this
		 */
		function PassAll() {
		}
		/*
		 * an instrunction of setting attribute
		 */
		function Attr(attr) {
			this.attr = attr;
		}
		/*
		 * an instrunction of simply executing an action
		 */
		function Action(action) {
			this.action = action;
		}
		/*
		 * an instruction of ignoring space, etc.
		 */
		function Ignore() {
		}
		/*
		 * an instruction of matching keyword using the given trie tree
		 */
		function MatchTrie(trie, word) {
			this.trie = trie;
			this.word = word;
		}
		/*
		 * tests a string.
		 * @param {String} str a string to be tested
		 * @param {Number} startIndex an index to be tested
		 * @param {Rena} rena a Rena object to be used
		 * @param {Number} startpc program counter to be started
		 * @param {Object} captures an object which stores attributes of repetation
		 * @param {Object} attribute an attribute to be inherited
		 * @param {Number} countRepetation a counter of repetation
		 * @return {Object} matched string, index and attribute, or null if the string is not matched
		 */
		function testRe(str, startIndex, rena, startpc, captures, attribute, countRepetation) {
			var pc = startpc,
				index = startIndex,
				attr = attribute,
				passAction = false,
				count = countRepetation ? countRepetation : 0,
				precount = 0,
				preattr,
				match,
				inst,
				beforeLength,
				i;
			function executeAction(attr, action, match) {
				if(passAction) {
					return undef;
				} else if(action) {
					return nvf(attr, action(match.match, match.attribute, attr, match.extra));
				} else {
					return nvf(attr, match.attribute);
				}
			}
			function executeRepeatAction(attr, inst, count) {
				if(inst.action) {
					for(i = 0; i < count; i++) {
						attr = executeAction(attr, actions[inst.action], captures[inst.action][i]);
					}
				}
				return attr;
			}
			function ignorePattern() {
				var match;
				if(rena._ignore && !!(match = rena._ignore(str, index, attr))) {
					index = match.lastIndex;
				}
			}
			captures = captures || {};
			outer: while(pc < rena._patterns.length) {
				inst = rena._patterns[pc];
				if(inst instanceof Then) {
					if(!!(match = inst.pattern(str, index, attr))) {
						index = match.lastIndex;
						attr = executeAction(attr, inst.action, match);
						if(inst.actionId) {
							captures[inst.actionId].push(match);
							precount = 1;
						}
						ignorePattern();
					} else {
						return null;
					}
					pc++;
				} else if(inst instanceof NewAction) {
					if(inst.action && !captures[inst.action]) {
						captures[inst.action] = [];
						preattr = attr;
					}
					pc++;
				} else if(inst instanceof Repeat) {
					if(!!(match = testRe(str, index, rena, pc + 1, captures, attr, count + 1))) {
						attr = passAction ? undef : nvf(attr, match.attribute);
						if(count === 0) {
							attr = nvf(attr, nvf(preattr, inst.init));
							attr = executeRepeatAction(attr, inst, match.count + precount);
						}
						return {
							match: str.substring(startIndex, match.lastIndex),
							lastIndex: match.lastIndex,
							attribute: attr,
							count: match.count
						};
					} else if(count >= inst.minimum) {
						if(count === inst.minimum) {
							attr = passAction ? undef : nvf(attr, nvf(preattr, inst.init));
							attr = executeRepeatAction(attr, inst, precount);
						}
						pc = pc + inst.addr;
					} else {
						return null;
					}
				} else if(inst instanceof Alt) {
					for(i = 0; i < inst.alternates.length; i++) {
						if(!!(match = inst.alternates[i](str, index, attr))) {
							if(inst.action) {
								captures[inst.action] = matchNext.match;
							}
							index = match.lastIndex;
							attr = passAction ? undef : nvf(attr, match.attribute);
							ignorePattern();
							pc++;
							continue outer;
						}
					}
					return null;
				} else if(inst instanceof GoTo) {
					if(inst.action) {
						captures[inst.action].push(match);
					}
					pc = inst.maximum >= 0 && count >= inst.maximum ? pc + 1 : pc + inst.addr;
				} else if(inst instanceof MatchTrie) {
					match = inst.trie.search(str, index);
					if(match.match === inst.word) {
						index = match.lastIndex;
						ignorePattern();
						pc++;
					} else {
						return null;
					}
				} else if(inst instanceof Lookahead) {
					if(!inst.pattern(str, index, attr) === inst.positive) {
						return null;
					}
					pc++;
				} else if(inst instanceof Cond) {
					if(!inst.cond(attr)) {
						return null;
					}
					pc++;
				} else if(inst instanceof Attr) {
					attr = passAction ? undef : inst.attr;
					pc++;
				} else if(inst instanceof Action) {
					attr = passAction ? undef : nvf(attr, inst.action(attr));
					pc++;
				} else if(inst instanceof PassAll) {
					passAction = true;
					pc++;
				} else if(inst instanceof Ignore) {
					ignorePattern();
					pc++;
				} else {
					throw new Error("Internal Error");
				}
			}
			return {
				match: str.substring(startIndex, index),
				lastIndex: index,
				attribute: attr,
				count: count
			};
		}
		function addArray(x, a, b) {
			var result = [].concat(b);
			result.push(a);
			return result;
		}
		/**
		 * The constructor of Rena.<br />
		 * If this function does not call as a constructor and arguments are given,
		 * this call is equivalent to Rena.then(pattern, match).
		 * @constructor
		 * @param {Object} pattern a pattern to match
		 * @param {Object} action an action 
		 */
		function Rena(pattern, action) {
			var res;
			if(!(this instanceof Rena)) {
				res = new Rena();
				if(pattern !== undef) {
					res.then(pattern, action);
				}
				return res;
			}
			this._patterns = [];
			this._ignore = Rena._ignore;
			this._trie = Rena._trie;
			this._noChain = false;
			if(this._ignore) {
				this._patterns.push(new Ignore());
			}
		}
		Rena.prototype = {
			_checkNoChain: function() {
				if(this._noChain) {
					throw new Error("this instance cannot repeat after this");
				}
			},
			_then: function(pattern, action) {
				this._patterns.push(new Then(pattern, action));
				return this;
			},
			/**
			 * <p>matches to the pattern simply.<br />
			 * A simple string, a regular expression, a function or a Rena object can be specified as a pattern.
			 *
			 * <p>The matching function must have two arguments,
			 * first argument is the string to match and second argument is the position to match,
			 * and return an object if it matches or null if it does not match.<br />
			 * The object to be returned has two properties,
			 * one of this is the matched string which named "match",
			 * another is the matched last position which named "lastMatch".
			 *
			 * <p>The given action will be called back with two or three arguments,
			 * first argument is the matched string,
			 * second argument is the inherited attribute,
			 * third argument, which is given when the pattern is regular expression, is the object which is returned by RegExp.exec().
			 *
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 */
			then: function(pattern, action) {
				this._checkNoChain();
				return this._then(pattern, action);
			},
			/**
			 * a shortcut of 'then'.
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 */
			t: function(pattern, action) {
				return this.then(pattern, action);
			},
			/**
			 * a shortcut of 'then(pattern, Rena.pass)'.
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			thenPass: function(pattern) {
				return this.then(pattern, Rena.pass);
			},
			/**
			 * a shortcut of 'then(pattern, function(x) { return parseInt(x); })'.
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			thenInt: function(pattern) {
				return this.then(pattern, function(x) {
					return parseInt(x);
				});
			},
			/**
			 * a shortcut of 'then(pattern, function(x) { return parseFloat(x); })'.
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			thenFloat: function(pattern) {
				return this.then(pattern, function(x) {
					return parseFloat(x);
				});
			},
			/**
			 * matches a newline.
			 * @return {Rena} this instance
			 */
			br: function() {
				return this._then(/\r\n|\r|\n/);
			},
			/**
			 * matches end of string
			 * @return {Rena} this instance
			 */
			isEnd: function() {
				return this._then(function(x, index) {
					return index < x.length ? null : {
						match: "",
						lastIndex: index
					};
				});
			},
			/**
			 * matches the identifier.
			 * @param {String} id identifier to match
			 * @return {Rena} this instance
			 */
			equalsId: function(id) {
				var me = this;
				if(typeof id !== "string") {
					throw new Error("argument must be a string");
				}
				return this._then(id).lookahead(function(str, index) {
					var matched = {
						match: "",
						lastIndex: index
					};
					if(index === str.length) {
						return matched;
					} else if(!me._trie || me._trie.search(str, index).lastIndex > index) {
						return matched;
					} else {
						return null;
					}
				});
			},
			/**
			 * matches one of the given patterns.
			 * @return {Rena} this instance
			 */
			or: function() {
				var alts = [],
					i;
				this._checkNoChain();
				for(i = 0; i < arguments.length; i++) {
					alts[i] = wrap(arguments[i]);
				}
				this._patterns.push(new Alt(null, alts));
				return this;
			},
			/**
			 * <p>repeats the given patterns to the given count.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 *
			 * <p>The given action will be called back with three arguments,
			 * first argument is the matched string,
			 * second argument is the attribute of repeating pattern,
			 * third argument is the inherited attribute.
			 *
			 * @param {Number} countmin minimum of repetation
			 * @param {Number} countmax maximum of repetation
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 */
			times: function(countmin, countmax, pattern, action, init) {
				var action = new NewAction(action),
					repeat = new Repeat(action.action, init, 0, countmin),
					addr;
				if(countmin < 0) {
					throw new Error("minimum of repetition must be non negative");
				} else if(countmin == 0 && countmax == 0) {
					throw new Error("both minimum and maximum must not be all zero");
				} else if(countmax >= 0 && (countmin > countmax)) {
					throw new Error("minimum must be less than or equal to maximum");
				}
				this._checkNoChain();
				this._patterns.push(action);
				addr = this._patterns.length;
				this._patterns.push(repeat);
				this.then(wrap(pattern));
				this._patterns.push(new GoTo(action.action, addr - this._patterns.length, countmax));
				repeat.addr = this._patterns.length - addr;
				this._noChain = true;
				return this;
			},
			/**
			 * repeats the given patterns at least the given count.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count minimum of repetation
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 */
			atLeast: function(count, pattern, action, init) {
				return this.times(count, -1, pattern, action, init);
			},
			/**
			 * repeats the given patterns at most the given count.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count maximum of repetation
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 */
			atMost: function(count, pattern, action, init) {
				return this.times(0, count, pattern, action, init);
			},
			/**
			 * matches zero or one of the given patterns.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 */
			maybe: function(pattern, action) {
				return this.times(0, 1, pattern, action);
			},
			/**
			 * a shortcut of 'atLeast(0, pattern, action, init)'.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 */
			zeroOrMore: function(pattern, action, init) {
				return this.atLeast(0, pattern, action, init);
			},
			/**
			 * a shortcut of 'atLeast(1, pattern, action, init)'.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 */
			oneOrMore: function(pattern, action, init) {
				return this.atLeast(1, pattern, action, init);
			},
			/**
			 * matches a string which is delimited by the given string.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Object} delimiter a pattern of delimiter
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 */
			delimit: function(pattern, delimiter, action, init) {
				var action = new NewAction(action),
					repeat = new Repeat(action.action, init, 0, 0),
					addr;
				this._checkNoChain();
				this._patterns.push(action);
				this._patterns.push(new Then(pattern, null, action.action));
				addr = this._patterns.length;
				this._patterns.push(repeat);
				this.then(wrap(delimiter));
				this.then(wrap(pattern));
				this._patterns.push(new GoTo(action.action, addr - this._patterns.length, -1));
				repeat.addr = this._patterns.length - addr;
				this._noChain = true;
				return this;
			},
			/**
			 * repeats the given patterns to the given count with accumlating an attribute into array.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} countmin minimum of repetation
			 * @param {Number} countmax maximum of repetation
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			timesArray: function(countmin, countmax, pattern) {
				return this.times(countmin, countmax, pattern, addArray, []);
			},
			/**
			 * repeats the given patterns at least the given count with accumlating an attribute into array.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count minimum of repetation
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			atLeastArray: function(count, pattern) {
				return this.times(count, -1, pattern, addArray, []);
			},
			/**
			 * repeats the given patterns at most the given count with accumlating an attribute into array.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count maximum of repetation
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			atMostArray: function(count, pattern) {
				return this.times(0, count, pattern, addArray, []);
			},
			/**
			 * a shortcut of 'atLeastArray(0, pattern)'.
			 * This instance cannot chain matching after this call except br() and isEnd().<br />
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			zeroOrMoreArray: function(pattern) {
				return this.atLeast(0, pattern, addArray, []);
			},
			/**
			 * a shortcut of 'atLeastArray(1, pattern)'.
			 * This instance cannot chain matching after this call except br() and isEnd().<br />
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			oneOrMoreArray: function(pattern) {
				return this.atLeast(1, pattern, addArray, []);
			},
			/**
			 * matches a string which is delimited by the given string with accumlating an attribute into array.<br />
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Object} delimiter a pattern of delimiter
			 * @return {Rena} this instance
			 */
			delimitArray: function(pattern, delimiter) {
				return this.delimit(pattern, delimiter, addArray, []);
			},
			/**
			 * matches the pattern not consuming the string to be matched.
			 * @param {Object} pattern a pattern to match
			 * @param {Boolean} positive succeed when the pattern does not match if this value is falsy
			 * @return {Rena} this instance
			 */
			lookahead: function(pattern, positive) {
				var pos = positive === undef ? true : positive;
				this._checkNoChain();
				this._patterns.push(new Lookahead(wrap(pattern), pos));
				return this;
			},
			/**
			 * a shortcut of 'lookahead(pattern, false)'.
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 */
			lookaheadNot: function(pattern) {
				return this.lookahead(pattern, false);
			},
			/**
			 * matches the pattern if the given condition is truthy.
			 * @param {Function} cond the condition
			 * @return {Rena} this instance
			 */
			cond: function(cond) {
				this._checkNoChain();
				this._patterns.push(new Cond(cond));
				return this;
			},
			/**
			 * ignores all action after this.
			 * @return {Rena} this instance
			 */
			passAll: function() {
				this._checkNoChain();
				this._patterns.push(new PassAll());
				return this;
			},
			/**
			 * sets the given value as the attribute.
			 * @param {Object} attr an attribute
			 * @return {Rena} this instance
			 */
			attr: function(attr) {
				this._checkNoChain();
				this._patterns.push(new Attr(attr));
				return this;
			},
			/**
			 * execute the given action and sets the return value as the attribute.
			 * @param {Object} action an action
			 * @return {Rena} this instance
			 */
			action: function(action) {
				this._checkNoChain();
				this._patterns.push(new Action(action));
				return this;
			},
			/**
			 * matches a keyword.
			 * @param {String} word a keyword to be matched
			 * @param {Trie} trie a trie tree to match
			 * @return {Rena} this instance
			 */
			key: function(word, trie) {
				this._checkNoChain();
				this._patterns.push(new MatchTrie(trie ? trie : this._trie, word));
				return this;
			},
			/**
			 * checks whether any keywords are not matched.
			 * @param {Trie} trie a trie tree to match
			 * @return {Rena} this instance
			 */
			notKey: function(trie) {
				return this.key("", trie);
			},
			/**
			 * parses the given string from the given index.
			 * @param {String} str a string to be parsed
			 * @param {Number} index an index to start
			 * @param {Object} attribute an initial attribute
			 */
			parseStart: function(str, index, attribute) {
				var caps = {},
					attr = attribute,
					result,
					ind = index ? index : 0;
				return testRe(str, ind, this, 0, caps, attr);
			},
			/**
			 * parses the given string partially.
			 * @param {String} str a string to be parsed
			 * @param {Object} attribute an initial attribute
			 */
			parsePart: function(str, attribute) {
				var result,
					i;
				for(i = 0; i <= str.length; i++) {
					result = this.parseStart(str, i, attribute);
					if(result) {
						result.startIndex = i;
						return result;
					}
				}
				return null;
			},
			/**
			 * parses the given string continuously.
			 * @param {String} str a string to be parsed
			 * @param {Object} init an initial attribute
			 * @param {Function} action a function to accumlate attributes
			 * @return {Object} accumlated attribute
			 */
			parsePartGlobal: function(str, init, action) {
				var result,
					attr = init,
					matched = false,
					i;
				for(i = 0; i <= str.length; i++) {
					result = this.parseStart(str, i);
					if(result) {
						attr = action(result.attribute, attr);
						i = result.lastIndex;
						matched = true;
					}
				}
				return attr;
			},
			/**
			 * parses the given string continuously and accumlate to an array.
			 * @param {String} str a string to be parsed
			 * @return {Object} array of accumlated attribute
			 */
			parsePartGlobalArray: function(str) {
				return this.parsePartGlobal(str, [], function (a, b) {
					var result = [].concat(b);
					result.push(a);
					return result;
				});
			},
			/**
			 * parses the given string entirely.
			 * @param {String} str a string to be parsed
			 * @param {Object} attribute an initial attribute
			 */
			parse: function(str, attribute) {
				var result = this.parseStart(str, 0, attribute);
				return (result && result.lastIndex === str.length) ? result : null;
			}
		};
		/*
		 * defines static method.
		 */
		function generateStatic(name) {
			return function() {
				var res = new Rena(),
					args = Array.prototype.slice.call(arguments);
				return res[name].apply(res, args);
			}
		}
		for(i in Rena) {
			if(Rena.prototype.hasOwnProperty(i)) {
				Rena[i] = generateStatic(i);
			}
		}
		/**
		 * a shortcut for 'Rena().then()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @return {Rena} new instance
		 */
		Rena.then = function(pattern, action) {
			return new Rena().then(pattern, action);
		};
		/**
		 * a shortcut for 'Rena().t()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @return {Rena} new instance
		 */
		Rena.t = function(pattern, action) {
			return new Rena().then(pattern, action);
		};
		/**
		 * a shortcut for 'Rena().thenPass()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.thenPass = function(pattern) {
			return new Rena().thenPass(pattern);
		};
		/**
		 * a shortcut for 'Rena().thenInt()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.thenInt = function(pattern) {
			return new Rena().thenInt(pattern);
		};
		/**
		 * a shortcut for 'Rena().thenFloat()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.thenFloat = function(pattern) {
			return new Rena().thenFloat(pattern);
		};
		/**
		 * a shortcut for 'Rena().br()'.
		 * @return {Rena} new instance
		 */
		Rena.br = function() {
			return new Rena().br();
		};
		/**
		 * a shortcut for 'Rena().isEnd()'.
		 * @return {Rena} new instance
		 */
		Rena.isEnd = function() {
			return new Rena().isEnd();
		};
		/**
		 * a shortcut for 'Rena().equalsId()'.
		 * @param {String} id identifier to match
		 * @return {Rena} new instance
		 */
		Rena.equalsId = function(id) {
			return new Rena().equalsId(id);
		};
		/**
		 * a shortcut for 'Rena().or()'.
		 * @return {Rena} new instance
		 */
		Rena.or = function() {
			var res = new Rena(),
				args = Array.prototype.slice.call(arguments);
			return res.or.apply(res, args);
		};
		/**
		 * a shortcut for 'Rena().maybe()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @return {Rena} new instance
		 */
		Rena.maybe = function(pattern, action) {
			return new Rena().maybe(pattern, action);
		};
		/**
		 * a shortcut for 'Rena().times()'.
		 * @param {Number} countmin minimum of repetation
		 * @param {Number} countmax maximum of repetation
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 */
		Rena.times = function(countmin, countmax, pattern, action, init) {
			return new Rena().times(countmin, countmax, pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().atLeast()'.
		 * @param {Number} count minimum of repetation
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 */
		Rena.atLeast = function(count, pattern, action, init) {
			return new Rena().atLeast(count, pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().atMost()'.
		 * @param {Number} count maximum of repetation
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 */
		Rena.atMost = function(count, pattern, action, init) {
			return new Rena().atMost(count, pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().zeroOrMore()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 */
		Rena.zeroOrMore = function(pattern, action, init) {
			return new Rena().zeroOrMore(pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().oneOrMore()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 */
		Rena.oneOrMore = function(pattern, action, init) {
			return new Rena().oneOrMore(pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().delimit()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Object} delimiter a pattern of delimiter
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 */
		Rena.delimit = function(pattern, delimiter, action, init) {
			return new Rena().delimit(pattern, delimiter, action, init);
		};
		/**
		 * a shortcut for 'Rena().timesArray()'.
		 * @param {Number} countmin minimum of repetation
		 * @param {Number} countmax maximum of repetation
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.timesArray = function(countmin, countmax, pattern) {
			return new Rena().timesArray(countmin, countmax, pattern);
		};
		/**
		 * a shortcut for 'Rena().atLeastArray()'.
		 * @param {Number} count minimum of repetation
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.atLeastArray = function(count, pattern) {
			return new Rena().atLeastArray(count, pattern);
		};
		/**
		 * a shortcut for 'Rena().atMostArray()'.
		 * @param {Number} count maximum of repetation
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.atMostArray = function(count, pattern) {
			return new Rena().atMostArray(count, pattern);
		};
		/**
		 * a shortcut for 'Rena().zeroOrMoreArray()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.zeroOrMoreArray = function(pattern) {
			return new Rena().zeroOrMoreArray(pattern);
		};
		/**
		 * a shortcut for 'Rena().oneOrMoreArray()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.oneOrMoreArray = function(pattern) {
			return new Rena().oneOrMoreArray(pattern);
		};
		/**
		 * a shortcut for 'Rena().delimitArray()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Object} delimiter a pattern of delimiter
		 * @return {Rena} new instance
		 */
		Rena.delimitArray = function(pattern, delimiter) {
			return new Rena().delimitArray(pattern, delimiter);
		};
		/**
		 * a shortcut for 'Rena().lookahead()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Boolean} positive succeed when the pattern does not match if this value is falsy
		 * @return {Rena} new instance
		 */
		Rena.lookahead = function(pattern, positive) {
			return new Rena().lookahead(pattern, positive);
		};
		/**
		 * a shortcut for 'Rena().lookaheadNot()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 */
		Rena.lookaheadNot = function(pattern) {
			return new Rena().lookaheadNot(pattern);
		};
		/**
		 * a shortcut for 'Rena().cond()'.
		 * @param {Function} cond the condition
		 * @return {Rena} new instance
		 */
		Rena.cond = function(pattern) {
			return new Rena().cond(pattern);
		};
		/**
		 * a shortcut for 'Rena().passAll()'.
		 * @return {Rena} new instance
		 */
		Rena.passAll = function() {
			return new Rena().passAll();
		};
		/**
		 * a shortcut for 'Rena().attr()'.
		 * @param {Object} attr an attribute
		 * @return {Rena} new instance
		 */
		Rena.attr = function(attr) {
			return new Rena().attr(attr);
		};
		/**
		 * a shortcut for 'Rena().action()'.
		 * @param {Object} action an action
		 * @return {Rena} new instance
		 */
		Rena.action = function(action) {
			return new Rena().action(action);
		};
		/**
		 * a shortcut for 'Rena().key()'.
		 * @param {String} word a keyword to be matched
		 * @param {Trie} trie a trie tree to match
		 * @return {Rena} new instance
		 */
		Rena.key = function(word, trie) {
			return new Rena().key(word, trie);
		};
		/**
		 * a shortcut for 'Rena().notKey()'.
		 * @param {Trie} trie a trie tree to match
		 * @return {Rena} new instance
		 */
		Rena.notKey = function(trie) {
			return new Rena().notKey(trie);
		};
		Rena.pass = function() {};
		/**
		 * sets the pattern to be ignored.
		 * @param {Object} pattern a pattern to be ignored
		 */
		Rena.ignore = function(pattern) {
			Rena._ignore = pattern ? wrap(pattern) : null;
		};
		Rena.ignore(null);
		/**
		 * sets the keywords.
		 */
		Rena.setKey = function(keywords) {
			var keys;
			if(isArray(keywords)) {
				keys = keywords;
			} else {
				keys = Array.prototype.slice.call(arguments);
			}
			Rena._trie = new Trie(keys);
		};
		/**
		 * defines nonterminal variables.
		 */
		Rena.defineNonterminals = function(nonterminals) {
			var variables,
				result = [],
				i;
			if(isArray(nonterminals)) {
				variables = nonterminals;
			} else {
				variables = Array.prototype.slice.call(arguments);
			}
			for(i = 0; i < variables.length; i++) {
				result[variables[i]] = new Rena();
			}
			return result;
		};
		/**
		 * generates a function which accumlates value using the given method.
		 * @param {String} method name when the value accumlates
		 */
		Rena.accumlate = function(method) {
			return function(x, a, b) {
				return b[method](a);
			}
		};
		/**
		 * a function which returns first argument.
		 */
		Rena.I = function(x) { return x; };
		/**
		 * a function which returns first argument.
		 */
		Rena.first = function(x) { return x; };
		/**
		 * a function which returns second argument.
		 */
		Rena.SK = function(x, y) { return y; };
		/**
		 * a function which returns second argument.
		 */
		Rena.F = function(x, y) { return y; };
		/**
		 * a function which returns second argument.
		 */
		Rena.second = function(x, y) { return y; };
		/**
		 * a fixed point combinator.
		 */
		Rena.Y = function(f) {
			return (function(g) {
				return g(g);
			})(function(g) {
				return f(function(str, index, captures) {
					var testFunc = wrap(g(g));
					return testFunc(str, index, captures);
				});
			});
		};
		/**
		 * a multiple fixed point combinator.<br />
		 * <a href="http://okmij.org/ftp/Computation/fixed-point-combinators.html">http://okmij.org/ftp/Computation/fixed-point-combinators.html</a>
		 */
		Rena.Yn = function() {
			var l = Array.prototype.slice.call(arguments),
				i,
				res;
			res = (function(g) {
				return g(g);
			})(function(p) {
				var i,
					li,
					res = [];
				for(i = 0; i < l.length; i++) {
					(function (li) {
						res.push(function(str, index, captures) {
							return (wrap(li.apply(null, p(p))))(str, index, captures);
						});
					})(l[i]);
				}
				return res;
			});
			for(i = 0; i < res.length; i++) {
				res[i] = new Rena().then(res[i]);
			}
			return res[0];
		};
		/**
		 * An alias of Rena.Yn().
		 */
		Rena.letrec = function() {
			var args = Array.prototype.slice.call(arguments);
			return Rena.Yn.apply(null, args);
		}
		/**
		 * creates the keywords.
		 * @return {Trie} a trie tree of keywords
		 */
		Rena.createKey = function(keywords) {
			var keys;
			if(isArray(keywords)) {
				keys = keywords;
			} else {
				keys = Array.prototype.slice.call(arguments);
			}
			return new Trie(keys);
		};
		return Rena;
	};
	RenaModule = RenaFactory();
	/*
	 * clones the module.
	 * @return {Object} a cloned module
	 */
	RenaModule.clone = RenaFactory;
	if(typeof module !== "undefined" && module.exports) {
		module.exports = RenaModule;
	} else {
		root["Rena"] = root["R"] = RenaModule;
	}
})(this);
