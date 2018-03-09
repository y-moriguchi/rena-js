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
		undef = void 0;
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
	/**
	 * a function which creates Rena module.
	 */
	function RenaFactory() {
		/**
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
					return pattern.parse(str, index, attr);
				};
			} else if(typeof pattern === "function") {
				return pattern;
			} else {
				throw new Error("Unsupported Type");
			}
		}
		/**
		 * an instruction of new action
		 */
		function NewAction(action) {
			actions[actionId] = action;
			this.action = actionId++;
		}
		/**
		 * a repetation instruction
		 */
		function Repeat(action, init, addr, minimum) {
			this.action = action;
			this.init = init;
			this.addr = addr;
			this.minimum = minimum;
		}
		/**
		 * an instruction of alternation
		 */
		function Alt(action, alternates) {
			this.action = action;
			this.alternates = alternates;
		}
		/**
		 * an instruction of control flow
		 */
		function GoTo(action, addr, maximum) {
			this.action = action;
			this.addr = addr;
			this.maximum = maximum;
		}
		/**
		 * an instruction of simple match
		 */
		function Then(pattern, action, actionId) {
			this.pattern = wrap(pattern);
			this.action = action;
			this.actionId = actionId;
		}
		/**
		 * an instruction of lookaehad
		 */
		function Lookahead(pattern, positive) {
			this.pattern = wrap(pattern);
			this.positive = positive;
		}
		/**
		 * an instruction of condition
		 */
		function Cond(cond) {
			this.cond = cond;
		}
		/**
		 * an instruction of passing all actions after this
		 */
		function PassAll() {
		}
		/**
		 * an instrunction of setting attribute
		 */
		function Attr(attr) {
			this.attr = attr;
		}
		/**
		 * an instrunction of simply executing an action
		 */
		function Action(action) {
			this.action = action;
		}
		/**
		 * an instruction of ignoring space, etc.
		 */
		function Ignore() {
		}
		/**
		 * an instruction of matching keyword using the given trie tree
		 */
		function MatchTrie(trie, word) {
			this.trie = trie;
			this.word = word;
		}
		/**
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
			function executeRepeatAction(attr, inst) {
				if(inst.action) {
					for(i = 0; i < captures[inst.action].length; i++) {
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
						}
						ignorePattern();
					} else {
						return null;
					}
					pc++;
				} else if(inst instanceof NewAction) {
					if(inst.action && !captures[inst.action]) {
						captures[inst.action] = [];
					}
					pc++;
				} else if(inst instanceof Repeat) {
					if(!!(match = testRe(str, index, rena, pc + 1, captures, attr, count + 1))) {
						attr = passAction ? undef : nvf(attr, match.attribute);
						if(count === 0) {
							attr = nvf(attr, inst.init);
							attr = executeRepeatAction(attr, inst);
						}
						return {
							match: str.substring(startIndex, match.lastIndex),
							lastIndex: match.lastIndex,
							attribute: attr
						};
					} else if(count >= inst.minimum) {
						if(inst.captureName && captures[inst.action].length > 0) {
							captures[inst.action].pop();
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
					attr = inst.attr;
					pc++;
				} else if(inst instanceof Action) {
					attr = nvf(attr, inst.action(attr));
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
				attribute: attr
			};
		}
		/**
		 * The constructor of Rena.
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
			if(this._ignore) {
				this._patterns.push(new Ignore());
			}
		}
		Rena.prototype = {
			/**
			 * simply matches to the pattern.
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 */
			then: function(pattern, action) {
				this._patterns.push(new Then(pattern, action));
				return this;
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
				return this.then(/\r|\n|\r\n/);
			},
			/**
			 * matches one of the given patterns.
			 * @return {Rena} this instance
			 */
			or: function() {
				var alts = [],
					i;
				for(i = 0; i < arguments.length; i++) {
					alts[i] = wrap(arguments[i]);
				}
				this._patterns.push(new Alt(null, alts));
				return this;
			},
			/**
			 * matches zero or one of the given patterns.
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 */
			maybe: function(pattern, action) {
				var action = new NewAction(action);
				this._patterns.push(action);
				this._patterns.push(new Repeat(action.action, undef, 2, 0));
				this.then(wrap(pattern));
				return this;
			},
			/**
			 * repeats the given patterns to the given count.
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
				} else if(countmax >= 0 && (countmin > countmax)) {
					throw new Error("minimum must be less than or equal to maximum");
				}
				this._patterns.push(action);
				addr = this._patterns.length;
				this._patterns.push(repeat);
				this.then(wrap(pattern));
				this._patterns.push(new GoTo(action.action, addr - this._patterns.length, countmax));
				repeat.addr = this._patterns.length - addr;
				return this;
			},
			/**
			 * repeats the given patterns at least the given count.
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
			 * repeats the given patterns at most the given count.
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
			 * a shortcut of 'atLeast(0, pattern, action, init)'.
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 */
			zeroOrMore: function(pattern, action, init) {
				return this.atLeast(0, pattern, action, init);
			},
			/**
			 * a shortcut of 'atLeast(1, pattern, action, init)'.
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 */
			oneOrMore: function(pattern, action, init) {
				return this.atLeast(1, pattern, action, init);
			},
			/**
			 * matches a string which is delimited by the given string.
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
				this._patterns.push(action);
				this._patterns.push(new Then(pattern, null, action.action));
				addr = this._patterns.length;
				this._patterns.push(repeat);
				this.then(wrap(delimiter));
				this.then(wrap(pattern));
				this._patterns.push(new GoTo(action.action, addr - this._patterns.length, -1));
				repeat.addr = this._patterns.length - addr;
				return this;
			},
			/**
			 * matches the pattern not consuming the string to be matched.
			 * @param {Object} pattern a pattern to match
			 * @param {Boolean} positive succeed when the pattern does not match if this value is falsy
			 * @return {Rena} this instance
			 */
			lookahead: function(pattern, positive) {
				var pos = positive === undef ? true : positive;
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
				this._patterns.push(new Cond(cond));
				return this;
			},
			/**
			 * ignores all action after this.
			 * @return {Rena} this instance
			 */
			passAll: function() {
				this._patterns.push(new PassAll());
				return this;
			},
			/**
			 * sets the given value as the attribute.
			 * @param {Object} attr an attribute
			 * @return {Rena} this instance
			 */
			attr: function(attr) {
				this._patterns.push(new Attr(attr));
				return this;
			},
			/**
			 * execute the given action and sets the return value as the attribute.
			 * @param {Object} action an action
			 * @return {Rena} this instance
			 */
			action: function(action) {
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
			 * parses the given string.
			 * @param {String} str a string to be parsed
			 * @param {Number} index an index to start
			 * @param {Object} attribute an initial attribute
			 */
			parse: function(str, index, attribute) {
				var caps = {},
					attr = attribute,
					result,
					ind = index ? index : 0;
				return testRe(str, ind, this, 0, caps, attr);
			}
		};
		/**
		 * defines static method.
		 */
		function generateStatic(name) {
			return function() {
				var res = new Rena(),
					args = Array.prototype.slice.call(arguments);
				return res[name].apply(res, args);
			}
		}
		Rena.then = generateStatic("then");
		Rena.t = generateStatic("t");
		Rena.thenPass = generateStatic("thenPass");
		Rena.thenInt = generateStatic("thenInt");
		Rena.thenFloat = generateStatic("thenFloat");
		Rena.br = generateStatic("br");
		Rena.or = generateStatic("or");
		Rena.maybe = generateStatic("maybe");
		Rena.times = generateStatic("times");
		Rena.atLeast = generateStatic("atLeast");
		Rena.atMost = generateStatic("atMost");
		Rena.zeroOrMore = generateStatic("zeroOrMore");
		Rena.oneOrMore = generateStatic("oneOrMore");
		Rena.delimit = generateStatic("delimit");
		Rena.lookahead = generateStatic("lookahead");
		Rena.lookaheadNot = generateStatic("lookaheadNot");
		Rena.cond = generateStatic("cond");
		Rena.passAll = generateStatic("passAll");
		Rena.attr = generateStatic("attr");
		Rena.action = generateStatic("action");
		Rena.key = generateStatic("key");
		Rena.notKey = generateStatic("notKey");
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
		 * a function which returns first argument.
		 */
		Rena.I = function(x) { return x; };
		/**
		 * a function which returns second argument.
		 */
		Rena.SK = Rena.F = function(x, y) { return y; };
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
		 * a multiple fixed point combinator.
		 * http://okmij.org/ftp/Computation/fixed-point-combinators.html
		 */
		Rena.letrec = Rena.Yn = function() {
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
	/**
	 * clones the module.
	 * @return {Object} a cloned module
	 */
	RenaModule.clone = RenaFactory;
	if(typeof module !== "undefined" && module.exports) {
		module.exports = RenaModule;
	} else {
		root["R"] = RenaModule;
	}
})(this);
