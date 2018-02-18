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
		actionId = 1;
	function nvf(old, value) {
		return (value === void 0 || value === null) ? old : value;
	}
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
						lastIndex: index + regex.lastIndex
					};
				} else {
					return null;
				}
			};
		} else if(pattern instanceof Rena) {
			return function(str, index, attr) {
				return pattern.test(str, index, attr);
			};
		} else if(typeof pattern === "function") {
			return pattern;
		} else {
			throw new Error("Unsupported Type");
		}
	}
	function NewAction(action) {
		actions[actionId] = action;
		this.action = actionId++;
	}
	function StarMaybe(captureName) {
		this.captureName = captureName;
	}
	function Alt(captureName, alternates) {
		this.captureName = captureName;
		this.alternates = alternates;
	}
	function GoTo(captureName) {
		this.captureName = captureName;
	}
	function Then(pattern, action) {
		this.pattern = wrap(pattern);
		this.action = action;
	}
	function Rena(attribute) {
		if(!(this instanceof Rena)) {
			return new Rena();
		}
		this._patterns = [];
		this._attribute = attribute;
	}
	function testRe(str, startIndex, rena, startpc, captures, attribute) {
		var pc = startpc,
			index = startIndex,
			attr = attribute,
			match,
			inst,
			count = 0,
			beforeLength,
			i;
		captures = captures || {};
		outer: while(pc < rena._patterns.length) {
			inst = rena._patterns[pc];
			if(inst instanceof NewAction) {
				if(inst.action && !captures[inst.action]) {
					captures[inst.action] = [];
				}
				pc++;
			} else if(inst instanceof StarMaybe) {
				if(!!(match = testRe(str, index, rena, pc + 1, captures, attr))) {
					attr = nvf(attr, match.attribute);
					if(inst.captureName) {
						if(count === 0) {
							for(i = 0; i < captures[inst.captureName].length; i++) {
								attr = nvf(attr, actions[inst.captureName](captures[inst.captureName][i].match));
							}
						}
					}
					return {
						match: str.substring(startIndex, match.lastIndex),
						lastIndex: match.lastIndex,
						attribute: attr
					};
				} else {
					if(inst.captureName) {
						captures[inst.captureName].pop();
					}
					pc = pc + 3;
				}
			} else if(inst instanceof Alt) {
				for(i = 0; i < inst.alternates.length; i++) {
					if(!!(match = inst.alternates[i](str, index, attr))) {
						if(inst.captureName) {
							captures[inst.captureName] = matchNext.match;
						}
						index = match.lastIndex;
						attr = nvf(attr, match.attribute);
						pc++;
						continue outer;
					}
				}
				return null;
			} else if(inst instanceof GoTo) {
				if(inst.captureName) {
					captures[inst.captureName].push(match);
				}
				count++;
				pc = match.match === "" ? pc + 1 : pc - 2;
			} else if(inst instanceof Then) {
				if(!!(match = inst.pattern(str, index, attr))) {
					index = match.lastIndex;
					if(inst.action) {
						attr = nvf(attr, inst.action(match.match, match.attribute, attr));
					} else {
						attr = nvf(attr, match.attribute);
					}
				} else {
					return null;
				}
				pc++;
			}
		}
		return {
			match: str.substring(startIndex, index),
			lastIndex: index,
			attribute: attr
		};
	}
	Rena.prototype = {
		then: function(pattern, action) {
			this._patterns.push(new Then(pattern, action));
			return this;
		},
		or: function() {
			var alts = [],
				i;
			for(i = 0; i < arguments.length; i++) {
				alts[i] = wrap(arguments[i]);
			}
			this._patterns.push(new Alt(null, alts));
			return this;
		},
		anyChars: function() {
			this._patterns.push(function(str, index) {
				if(index < str.length) {
					return {
						match: str.charAt(index),
						lastIndex: index + 1
					}
				} else {
					return null;
				}
			});
			return this;
		},
		zeroOrMore: function(pattern, action) {
			var action = new NewAction(action);
			this._patterns.push(action);
			this._patterns.push(new StarMaybe(action.action));
			this.then(wrap(pattern));
			this._patterns.push(new GoTo(action.action));
			return this;
		},
		test: function(str, index, attribute) {
			var caps = {},
				attr = nvf(this._attribute, attribute),
				result,
				ind = index ? index : 0;
			return testRe(str, ind, this, 0, caps, attr);
		}
	};
	Rena.delay = function(thunk) {
		var memo = null;
		return function(str, index) {
			if(!memo) {
				memo = thunk();
			}
			return memo(str, index);
		};
	};
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
	 * http://okmij.org/ftp/Computation/fixed-point-combinators.html
	 */
	Rena.Yn = function() {
		var l = Array.prototype.slice.call(arguments);
		return (function(g) {
			return g(g);
		})(function(p) {
			return l.map(function(li) {
				return function(str, index, captures) {
					return (wrap(li.apply(null, p(p))))(str, index, captures);
				};
			});
		}).map(function(f) { return new Rena().then(f); })[0];
	};
	if(typeof module !== "undefined" && module.exports) {
		module.exports = Rena;
	} else {
		root["R"] = Rena;
	}
})(this);
