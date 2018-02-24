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
	function Repeat(action, init, addr, minimum) {
		this.action = action;
		this.init = init;
		this.addr = addr;
		this.minimum = minimum;
	}
	function Alt(action, alternates) {
		this.action = action;
		this.alternates = alternates;
	}
	function GoTo(action, addr, maximum) {
		this.action = action;
		this.addr = addr;
		this.maximum = maximum;
	}
	function Then(pattern, action, actionId) {
		this.pattern = wrap(pattern);
		this.action = action;
		this.actionId = actionId;
	}
	function Lookahead(pattern, positive) {
		this.pattern = wrap(pattern);
		this.positive = positive;
	}
	function Cond(cond) {
		this.cond = cond;
	}
	function PassAll() {
	}
	function Rena(attribute) {
		if(!(this instanceof Rena)) {
			return new Rena();
		}
		this._patterns = [];
		this._attribute = attribute;
	}
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
				return void 0;
			} else if(action) {
				return nvf(attr, action(match.match, match.attribute, attr));
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
					attr = passAction ? void 0 : nvf(attr, match.attribute);
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
						attr = passAction ? void 0 : nvf(attr, match.attribute);
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
			} else if(inst instanceof PassAll) {
				passAction = true;
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
		thenPass: function(pattern) {
			return this.then(pattern, Rena.pass);
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
		maybe: function(pattern, action) {
			var action = new NewAction(action);
			this._patterns.push(action);
			this._patterns.push(new Repeat(action.action, void 0, 2, 0));
			this.then(wrap(pattern));
			return this;
		},
		times: function(countmin, countmax, pattern, action, init) {
			var action = new NewAction(action);
			this._patterns.push(action);
			this._patterns.push(new Repeat(action.action, init, 3, countmin));
			this.then(wrap(pattern));
			this._patterns.push(new GoTo(action.action, -2, countmax));
			return this;
		},
		atLeast: function(count, pattern, action, init) {
			return this.times(count, -1, pattern, action, init);
		},
		atMost: function(count, pattern, action, init) {
			return this.times(0, count, pattern, action, init);
		},
		zeroOrMore: function(pattern, action, init) {
			return this.atLeast(0, pattern, action, init);
		},
		delimit: function(pattern, delimiter, action, init) {
			var action = new NewAction(action);
			this._patterns.push(action);
			this._patterns.push(new Then(pattern, null, action.action));
			this._patterns.push(new Repeat(action.action, init, 4, 0));
			this.then(wrap(delimiter));
			this.then(wrap(pattern));
			this._patterns.push(new GoTo(action.action, -3, -1));
			return this;
		},
		lookahead: function(pattern, positive) {
			var pos = positive === void 0 ? true : positive;
			this._patterns.push(new Lookahead(wrap(pattern), pos));
			return this;
		},
		lookaheadNot: function(pattern) {
			return this.lookahead(pattern, false);
		},
		cond: function(cond) {
			this._patterns.push(new Cond(cond));
			return this;
		},
		passAll: function() {
			this._patterns.push(new PassAll());
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
	Rena.pass = function() {};
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
