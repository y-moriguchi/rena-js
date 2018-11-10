/*
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
	/*
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
		/*
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
		function Then(pattern, action, actionId, notIgnore) {
			this.pattern = wrap(pattern);
			this.action = action;
			this.actionId = actionId;
			this.notIgnore = notIgnore;
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
						if(!inst.notIgnore) {
							ignorePattern();
						}
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
		 * The constructor of Rena.  
		 * If this function does not call as a constructor and arguments are given,
		 * this call is equivalent to Rena.then(pattern, match).
		 * @ja
		 * Renaのコンストラクタです。  
		 * コンストラクタとして呼ばなかった時はRena.then(pattern, match)と同じです。
		 * @constructor
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action(call as method)
		 * @param {Object} ignore a pattern to ignore(constructor)
		 */
		function Rena(pattern, action, ignore) {
			var res;
			if(!(this instanceof Rena)) {
				return new Rena(pattern, action, ignore);
			}
			this._patterns = [];
			this._ignore = ignore === undef ? Rena._ignore : ignore;
			this._trie = Rena._trie;
			this._noChain = false;
			if(this._ignore) {
				this._patterns.push(new Ignore());
			}
			if(pattern !== undef) {
				this.then(pattern, action);
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
			 * @class Rena
			 * matches to the pattern simply.  
			 * A simple string, a regular expression, a function or a Rena object can be specified as a pattern.  
			 * The matching function must have two arguments,
			 * first argument is the string to match and second argument is the position to match,
			 * and return an object if it matches or null if it does not match.  
			 * The object to be returned has two properties,
			 * one of this is the matched string which named "match",
			 * another is the matched last position which named "lastMatch".  
			 * The given action will be called back with two or three arguments,
			 * first argument is the matched string,
			 * second argument is the inherited attribute,
			 * third argument is the synthesized attribute.
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 * @ja
			 * 単純にパターンとマッチします。  
			 * パターンには単純な文字列、正規表現、関数、Renaオブジェクトが指定できます。  
			 * マッチする関数は2つの引数を持ちます。  
			 * 最初の引数はマッチさせる文字列、2番目の引数はマッチさせたい文字列の位置が指定されます。  
			 * 関数はオブジェクト(マッチしたとき)、またはnull(マッチしなかったとき)を返します。  
			 * オブジェクトは2つのプロパティを持つ必要があります。  
			 * マッチしたオブジェクトを格納する"match"と、マッチした最後の位置を表す"lastMatch"です。  
			 * アクションは2つか3つの引数とともにコールバックされます。  
			 * 最初の引数はマッチした文字列、2番目のマッチしたパターンが返した属性、3番目は継承された属性です。
			 * ```
			 * R.then("765").then("pro");
			 * ```
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Function} action 呼び出されるアクション
			 * @return {Rena} このインスタンス
			 */
			then: function(pattern, action) {
				this._checkNoChain();
				return this._then(pattern, action);
			},
			/**
			 * @class Rena
			 * a shortcut of 'then'.
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 * @ja
			 * 'then'のショートカットです。
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Function} action 呼び出されるアクション
			 * @return {Rena} このインスタンス
			 */
			t: function(pattern, action) {
				return this.then(pattern, action);
			},
			/**
			 * @class Rena
			 * a shortcut of 'then(pattern, Rena.pass)'.
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * 'then(pattern, Rena.pass)'のショートカットです。
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			thenPass: function(pattern) {
				return this.then(pattern, Rena.pass);
			},
			/**
			 * @class Rena
			 * a shortcut of 'then(pattern, function(x) { return parseInt(x); })'.
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * 'then(pattern, function(x) { return parseInt(x); })'のショートカットです。
			 * ```
			 * R.thenInt(/[0-9]+/);
			 * ```
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			thenInt: function(pattern) {
				return this.then(pattern, function(x) {
					return parseInt(x);
				});
			},
			/**
			 * @class Rena
			 * a shortcut of 'then(pattern, function(x) { return parseFloat(x); })'.
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * 'then(pattern, function(x) { return parseFloat(x); })'のショートカットです。
			 * ```
			 * R.thenFloat(/[0-9]+\.[0-9]/);
			 * ```
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			thenFloat: function(pattern) {
				return this.then(pattern, function(x) {
					return parseFloat(x);
				});
			},
			/**
			 * @class Rena
			 * matches a newline.
			 * @return {Rena} this instance
			 * @ja
			 * 改行文字にマッチします。
			 * ```
			 * R.br();
			 * ```
			 * @return {Rena} このインスタンス
			 */
			br: function() {
				return this._then(/\r\n|\r|\n/);
			},
			/**
			 * @class Rena
			 * matches end of string
			 * @return {Rena} this instance
			 * @ja
			 * 文字列の終わりにマッチします。
			 * ```
			 * R.then("end").isEnd();
			 * ```
			 * @return {Rena} このインスタンス
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
			 * @class Rena
			 * matches the identifier.
			 * @param {String} id identifier to match
			 * @return {Rena} this instance
			 * @ja
			 * 識別子にマッチします。  
			 * 文字列の後に空白またはトークンが続くときにマッチします。
			 * ```
			 * R.equalsId("number").then(/[0-9]+/);
			 * ```
			 * @param {String} id マッチする識別子
			 * @return {Rena} このインスタンス
			 */
			equalsId: function(id) {
				var me = this;
				if(typeof id !== "string") {
					throw new Error("argument must be a string");
				}
				me._patterns.push(new Then(id, undef, undef, true));
				me.lookahead(function(str, index) {
					var matched = {
						match: "",
						lastIndex: index
					};
					if(index === str.length) {
						return matched;
					} else if(!me._ignore && !me._trie) {
						return matched;
					} else if(me._ignore && me._ignore(str, index)) {
						return matched;
					} else if(me._trie && me._trie.search(str, index).lastIndex > index) {
						return matched;
					} else {
						return null;
					}
				});
				me._patterns.push(new Ignore());
				return me;
			},
			/**
			 * @class Rena
			 * matches a float number and sets the number as an attribute.
			 * @param {Boolean} signum matches sign if signum is true
			 * @return {Rean} this instance
			 * @ja
			 * 浮動小数点数にマッチし、その値を属性として返します。
			 * ```
			 * R.real();
			 * ```
			 * @param {Boolean} signum trueのとき符号にもマッチさせる
			 * @return {Rean} このインスタンス
			 */
			real: function(signum) {
				var nosign = /(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][\+\-]?[0-9]+)?/,
					withsign = /[\+\-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][\+\-]?[0-9]+)?/;
				return this.thenFloat(signum ? withsign : nosign);
			},
			/**
			 * @class Rena
			 * matches one of the given patterns.
			 * @return {Rena} this instance
			 * @ja
			 * 引数のパターンのいずれかにマッチするときマッチします。  
			 * バックトラックができます。
			 * ```
			 * R.or(R.then("765"), R.then("346"), R.then("283"));
			 * ```
			 * @return {Rena} このインスタンス
			 */
			or: function(alternatives) {
				var alts = [],
					args,
					i;
				this._checkNoChain();
				if(isArray(alternatives)) {
					args = alternatives;
				} else {
					args = Array.prototype.slice.call(arguments);
				}
				for(i = 0; i < args.length; i++) {
					alts[i] = wrap(args[i]);
				}
				this._patterns.push(new Alt(null, alts));
				return this;
			},
			/**
			 * @class Rena
			 * repeats the given patterns to the given count.  
			 * This instance cannot chain matching after this call except br() and isEnd().  
			 * The given action will be called back with three arguments,
			 * first argument is the matched string,
			 * second argument is the attribute of repeating pattern,
			 * third argument is the inherited attribute.
			 * @param {Number} countmin minimum of repetation
			 * @param {Number} countmax maximum of repetation
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 与えられたバターンを与えられた回数繰り返します。  
			 * アクションは3つの引数とともにコールバックされます。  
			 * 最初の引数はマッチした文字列、2番目は継承された属性、3番目はマッチしたパターンが返した属性です。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R.then(/[a-z]/, R.I)
			 *  .times(2, 4, function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Number} countmin 繰り返しの最小数
			 * @param {Number} countmax 繰り返しの最大数
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			times: function(countmin, countmax, action, init) {
				return Rena.times(countmin, countmax, this, action, init);
			},
			/**
			 * @class Rena
			 * repeats the given patterns at least the given count.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count minimum of repetation
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 与えられた回数以上パターンをマッチします。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R.then(/[a-z]/, R.I)
			 *  .atLeast(1, function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Number} count 繰り返しの最小数
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			atLeast: function(count, action, init) {
				return this.times(count, -1, action, init);
			},
			/**
			 * @class Rena
			 * repeats the given patterns at most the given count.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count maximum of repetation
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 最大与えられた回数までパターンをマッチします。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R.then(/[a-z]/, R.I)
			 *  .atMost(5, function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Number} count 繰り返しの最大数
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			atMost: function(count, action, init) {
				return this.times(0, count, action, init);
			},
			/**
			 * @class Rena
			 * matches zero or one of the given patterns.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 * @ja
			 * 0回または1回パターンをマッチします。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * R.then(/[a-z]/).maybe();
			 * ```
			 * @param {Function} action 呼び出されるアクション
			 * @return {Rena} このインスタンス
			 */
			maybe: function(action) {
				return this.times(0, 1, action);
			},
			/**
			 * @class Rena
			 * a shortcut of 'atLeast(0, pattern, action, init)'.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 'atLeast(0, pattern, action, init)'のショートカットです。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R.then(/[a-z]/, R.I)
			 *  .zeroOrMore(function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			zeroOrMore: function(action, init) {
				return this.atLeast(0, action, init);
			},
			/**
			 * @class Rena
			 * a shortcut of 'atLeast(1, pattern, action, init)'.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 'atLeast(1, pattern, action, init)'のショートカットです。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R.then(/[a-z]/, R.I)
			 *  .oneOrMore(function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			oneOrMore: function(action, init) {
				return this.atLeast(1, action, init);
			},
			/**
			 * @class Rena
			 * matches a string which is delimited by the given string.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} delimiter a pattern of delimiter
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 与えれれたデリミタで区切られたパターンにマッチします。
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "7+6+5" -> "567"
			 * R.then(/[0-9]+/, R.I)
			 *  .delimit("+", function(matched, inherited, synthesized) { return inherited + synthesized; }, "");
			 * ```
			 * @param {Object} delimiter デリミタのパターン
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			delimit: function(delimiter, action, init) {
				return Rena.delimit(this, delimiter, action, init);
			},
			/**
			 * @class Rena
			 * repeats the given patterns to the given count.  
			 * This instance cannot chain matching after this call except br() and isEnd().  
			 * The given action will be called back with three arguments,  
			 * first argument is the matched string,
			 * second argument is the attribute of repeating pattern,
			 * third argument is the inherited attribute.
			 * @param {Number} countmin minimum of repetation
			 * @param {Number} countmax maximum of repetation
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 与えられたバターンを与えられた回数繰り返します。  
			 * アクションは3つの引数とともにコールバックされます。  
			 * 最初の引数はマッチした文字列、2番目の引数は継承された属性、3番目はマッチしたパターンが返した属性です。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R().thenTimes(2, 4, R.then(/[a-z]/, R.I),
			 *      function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Number} countmin 繰り返しの最小数
			 * @param {Number} countmax 繰り返しの最大数
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			thenTimes: function(countmin, countmax, pattern, action, init) {
				var actionNew = new NewAction(action),
					repeat = new Repeat(actionNew.action, init, 0, countmin),
					addr;
				if(countmin < 0) {
					throw new Error("minimum of repetition must be non negative");
				} else if(countmin == 0 && countmax == 0) {
					throw new Error("both minimum and maximum must not be all zero");
				} else if(countmax >= 0 && (countmin > countmax)) {
					throw new Error("minimum must be less than or equal to maximum");
				}
				this._checkNoChain();
				this._patterns.push(actionNew);
				addr = this._patterns.length;
				this._patterns.push(repeat);
				this.then(wrap(pattern));
				this._patterns.push(new GoTo(actionNew.action, addr - this._patterns.length, countmax));
				repeat.addr = this._patterns.length - addr;
				this._noChain = true;
				return this;
			},
			/**
			 * @class Rena
			 * repeats the given patterns at least the given count.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count minimum of repetation
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 与えられた回数以上パターンをマッチします。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R().thenAtLeast(2, R.then(/[a-z]/, R.I),
			 *      function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Number} count 繰り返しの最小数
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			thenAtLeast: function(count, pattern, action, init) {
				return this.thenTimes(count, -1, pattern, action, init);
			},
			/**
			 * @class Rena
			 * repeats the given patterns at most the given count.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count maximum of repetation
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 最大与えられた回数までパターンをマッチします。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R().thenAtMost(4, R.then(/[a-z]/, R.I),
			 *      function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Number} count 繰り返しの最大数
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			thenAtMost: function(count, pattern, action, init) {
				return this.thenTimes(0, count, pattern, action, init);
			},
			/**
			 * @class Rena
			 * matches zero or one of the given patterns.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @return {Rena} this instance
			 * @ja
			 * 0回または1回パターンをマッチします。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * R.then("765").thenMaybe(R.then("pro"));
			 * ```
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Function} action 呼び出されるアクション
			 * @return {Rena} このインスタンス
			 */
			thenMaybe: function(pattern, action) {
				return this.thenTimes(0, 1, pattern, action);
			},
			/**
			 * @class Rena
			 * a shortcut of 'atLeast(0, pattern, action, init)'.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 'atLeast(0, pattern, action, init)'のショートカットです。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R().thenZeroOrMore(R.then(/[a-z]/, R.I),
			 *      function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			thenZeroOrMore: function(pattern, action, init) {
				return this.thenAtLeast(0, pattern, action, init);
			},
			/**
			 * @class Rena
			 * a shortcut of 'atLeast(1, pattern, action, init)'.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 'atLeast(1, pattern, action, init)'のショートカットです。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "abc" -> "cba"
			 * R().thenOneOrMore(R.then(/[a-z]/, R.I),
			 *      function(matched, inherited, synthesized) { return inherited + synthesized }, "");
			 * ```
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			thenOneOrMore: function(pattern, action, init) {
				return this.thenAtLeast(1, pattern, action, init);
			},
			/**
			 * @class Rena
			 * matches a string which is delimited by the given string.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Object} delimiter a pattern of delimiter
			 * @param {Function} action an action to be invoked
			 * @param {Object} init an initial attribute
			 * @return {Rena} this instance
			 * @ja
			 * 与えれれたデリミタで区切られたパターンにマッチします。
			 * このメソッドの後にパターンをマッチすることはできません。
			 * ```
			 * // "7+6+5" -> "567"
			 * R().thenDelimit(R.then(/[0-9]+/, R.I), "+",
			 *    function(matched, inherited, synthesized) { return inherited + synthesized; }, "");
			 * ```
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Object} delimiter デリミタのパターン
			 * @param {Function} action 呼び出されるアクション
			 * @param {Object} init 属性の初期値
			 * @return {Rena} このインスタンス
			 */
			thenDelimit: function(pattern, delimiter, action, init) {
				var actionNew = new NewAction(action),
					repeat = new Repeat(actionNew.action, init, 0, 0),
					addr;
				this._checkNoChain();
				this._patterns.push(actionNew);
				this._patterns.push(new Then(pattern, null, actionNew.action));
				addr = this._patterns.length;
				this._patterns.push(repeat);
				this.then(wrap(delimiter));
				this.then(wrap(pattern));
				this._patterns.push(new GoTo(actionNew.action, addr - this._patterns.length, -1));
				repeat.addr = this._patterns.length - addr;
				this._noChain = true;
				return this;
			},
			/**
			 * @class Rena
			 * repeats the given patterns to the given count with accumlating an attribute into array.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} countmin minimum of repetation
			 * @param {Number} countmax maximum of repetation
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * 与えられたバターンを与えられた回数繰り返して属性を配列に格納します。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * @param {Number} countmin 繰り返しの最小数
			 * @param {Number} countmax 繰り返しの最大数
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			timesArray: function(countmin, countmax, pattern) {
				return this.thenTimes(countmin, countmax, pattern, addArray, []);
			},
			/**
			 * @class Rena
			 * repeats the given patterns at least the given count with accumlating an attribute into array.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count minimum of repetation
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * 与えられた回数以上パターンをマッチして属性を配列に格納します。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * @param {Number} count 繰り返しの最小数
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			atLeastArray: function(count, pattern) {
				return this.thenTimes(count, -1, pattern, addArray, []);
			},
			/**
			 * @class Rena
			 * repeats the given patterns at most the given count with accumlating an attribute into array.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Number} count maximum of repetation
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * 最大与えられた回数までパターンをマッチして属性を配列に格納します。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * @param {Number} count 繰り返しの最大数
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			atMostArray: function(count, pattern) {
				return this.thenTimes(0, count, pattern, addArray, []);
			},
			/**
			 * @class Rena
			 * a shortcut of 'atLeastArray(0, pattern)'.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * 'atLeastArray(0, pattern, action, init)'のショートカットです。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			zeroOrMoreArray: function(pattern) {
				return this.thenAtLeast(0, pattern, addArray, []);
			},
			/**
			 * @class Rena
			 * a shortcut of 'atLeastArray(1, pattern)'.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * 'atLeastArray(1, pattern, action, init)'のショートカットです。  
			 * このメソッドの後にパターンをマッチすることはできません。
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			oneOrMoreArray: function(pattern) {
				return this.thenAtLeast(1, pattern, addArray, []);
			},
			/**
			 * @class Rena
			 * matches a string which is delimited by the given string with accumlating an attribute into array.  
			 * This instance cannot chain matching after this call except br() and isEnd().
			 * @param {Object} pattern a pattern to match
			 * @param {Object} delimiter a pattern of delimiter
			 * @return {Rena} this instance
			 * @ja
			 * 与えれれたデリミタで区切られたパターンにマッチします。
			 * このメソッドの後にパターンをマッチすることはできません。
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Object} delimiter デリミタのパターン
			 * @return {Rena} このインスタンス
			 */
			delimitArray: function(pattern, delimiter) {
				return this.thenDelimit(pattern, delimiter, addArray, []);
			},
			/**
			 * @class Rena
			 * matches the pattern not consuming the string to be matched.
			 * @param {Object} pattern a pattern to match
			 * @param {Boolean} positive succeed when the pattern does not match if this value is falsy
			 * @return {Rena} this instance
			 * @ja
			 * パターンを文字列を消費せずに先読みします。
			 * ```
			 * R.then("765").lookahead(R.then("pro"));
			 * ```
			 * @param {Object} pattern マッチさせるパターン
			 * @param {Boolean} positive trueのとき先読みが一致したときマッチ、falseのとき先読みが一致しないときマッチ
			 * @return {Rena} このインスタンス
			 */
			lookahead: function(pattern, positive) {
				var pos = positive === undef ? true : positive;
				this._checkNoChain();
				this._patterns.push(new Lookahead(wrap(pattern), pos));
				return this;
			},
			/**
			 * @class Rena
			 * a shortcut of 'lookahead(pattern, false)'.
			 * @param {Object} pattern a pattern to match
			 * @return {Rena} this instance
			 * @ja
			 * パターンを文字列を消費せずに否定先読みします。
			 * @param {Object} pattern マッチさせるパターン
			 * @return {Rena} このインスタンス
			 */
			lookaheadNot: function(pattern) {
				return this.lookahead(pattern, false);
			},
			/**
			 * @class Rena
			 * matches the pattern if the given condition is truthy.
			 * @param {Function} cond the condition
			 * @return {Rena} this instance
			 * @ja
			 * 属性が与えられた条件を満たすときにパターンにマッチします。
			 * ```
			 * // match only "765"
			 * R().thenInt(/[0-9]+/).cond(function(attribute) { return attribute === 765; });
			 * ```
			 * @param {Function} cond 条件
			 * @return {Rena} このインスタンス
			 */
			cond: function(cond) {
				this._checkNoChain();
				this._patterns.push(new Cond(cond));
				return this;
			},
			/**
			 * @class Rena
			 * ignores all action after this.
			 * @return {Rena} this instance
			 * @ja
			 * このメソッドの後のアクションを無視します。
			 * @return {Rena} このインスタンス
			 */
			passAll: function() {
				this._checkNoChain();
				this._patterns.push(new PassAll());
				return this;
			},
			/**
			 * @class Rena
			 * sets the given value as the attribute.
			 * @param {Object} attr an attribute
			 * @return {Rena} this instance
			 * @ja
			 * 属性を与えられた値にセットします。
			 * ```
			 * // "abc" -> "cbaz"
			 * R().attr("z")
			 *  .thenZeroOrMore(R.then(/[a-z]/, R.I), function(matched, inherited, synthesized) { return inherited + synthesized; });
			 * ```
			 * @param {Object} attr セットする属性
			 * @return {Rena} このインスタンス
			 */
			attr: function(attr) {
				this._checkNoChain();
				this._patterns.push(new Attr(attr));
				return this;
			},
			/**
			 * @class Rena
			 * execute the given action and sets the return value as the attribute.
			 * @param {Object} action an action
			 * @return {Rena} this instance
			 * @ja
			 * 与えられたアクションを実行し、戻り値を属性としてセットします。
			 * ```
			 * R.thenInt("765").action(function(attribute) { return attribute + 346; });
			 * ```
			 * @param {Function} action 実行するアクション
			 * @return {Rena} このインスタンス
			 */
			action: function(action) {
				this._checkNoChain();
				this._patterns.push(new Action(action));
				return this;
			},
			/**
			 * @class Rena
			 * matches a keyword.
			 * @param {String} word a keyword to be matched
			 * @param {Trie} trie a trie tree to match
			 * @return {Rena} this instance
			 * @ja
			 * キーワードにマッチします。
			 * @param {String} word マッチさせるキーワード
			 * @param {Trie} trie キーワードの集合
			 * @return {Rena} このインスタンス
			 */
			key: function(word, trie) {
				this._checkNoChain();
				this._patterns.push(new MatchTrie(trie ? trie : this._trie, word));
				return this;
			},
			/**
			 * @class Rena
			 * checks whether any keywords are not matched.
			 * @param {Trie} trie a trie tree to match
			 * @return {Rena} this instance
			 * @ja
			 * いかなるキーワードにもマッチしないときにマッチします。
			 * @param {Trie} trie キーワードの集合
			 * @return {Rena} このインスタンス
			 */
			notKey: function(trie) {
				return this.key("", trie);
			},
			/**
			 * @class Rena
			 * parses the given string from the given index.
			 * @param {String} str a string to be parsed
			 * @param {Number} index an index to start
			 * @param {Object} attribute an initial attribute
			 * @ja
			 * 与えられた位置からパースを開始します。
			 * ```
			 * // matched "765"
			 * R.then("765").parseStart("961765", 3).match;
			 * ```
			 * @param {String} str パースする文字列
			 * @param {Number} index マッチを開始する位置
			 * @param {Object} attribute 初期の属性
			 */
			parseStart: function(str, index, attribute) {
				var caps = {},
					attr = attribute,
					result,
					ind = index ? index : 0;
				return testRe(str, ind, this, 0, caps, attr);
			},
			/**
			 * @class Rena
			 * parses the given string partially.
			 * @param {String} str a string to be parsed
			 * @param {Object} attribute an initial attribute
			 * @ja
			 * 部分的にパースします。
			 * ```
			 * // result: "765"
			 * R.then("765").parsePart("876765346").match;
			 * // result: 3
			 * R.then("765").parsePart("876765346").startIndex;
			 * ```
			 * @param {String} str パースする文字列
			 * @param {Object} attribute 初期の属性
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
			 * @class Rena
			 * parses the given string continuously.
			 * @param {String} str a string to be parsed
			 * @param {Object} init an initial attribute
			 * @param {Function} action a function to accumlate attributes
			 * @return {Object} accumlated attribute
			 * @ja
			 * 部分的に繰り返してパースします。
			 * ```
			 * // result: "765876346"
			 * R.then(/[0-9]+/, R.I)
			 *  .parsePartGlobal("765x876xx346xxx", "", function (accumlated, matchedAttribute) { return matchedAttribute + accumlated; });
			 * ```
			 * @param {String} str パースする文字列
			 * @param {Object} init 初期の属性
			 * @param {Function} action 属性を累積する関数
			 * @return {Object} 累積された値
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
			 * @class Rena
			 * parses the given string continuously and accumlate to an array.
			 * @param {String} str a string to be parsed
			 * @return {Object} array of accumlated attribute
			 * @ja
			 * 部分的に繰り返してパースして配列に格納します。
			 * ```
			 * // result: ["765", "876", "346"]
			 * R.then(/[0-9]+/, R.I).parsePartGlobalArray("765x876xx346xxx");
			 * ```
			 * @param {String} str パースする文字列
			 * @return {Object} 累積された値
			 */
			parsePartGlobalArray: function(str) {
				return this.parsePartGlobal(str, [], function (a, b) {
					var result = [].concat(b);
					result.push(a);
					return result;
				});
			},
			/**
			 * @class Rena
			 * parses the given string entirely.
			 * @param {String} str a string to be parsed
			 * @param {Object} attribute an initial attribute
			 * @ja
			 * 文字列全体をパースします。
			 * ```
			 * // matched
			 * R.then("765").parse("765");
			 * // no match
			 * R.then("765").parse("765961");
			 * ```
			 * @param {String} str パースする文字列
			 * @param {Object} attribute 初期の属性
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
		 * @ja
		 * 'Rena().then()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Function} action 呼び出されるアクション
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.then = function(pattern, action) {
			return new Rena().then(pattern, action);
		};
		/**
		 * a shortcut for 'Rena().t()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().t()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Function} action 呼び出されるアクション
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.t = function(pattern, action) {
			return new Rena().then(pattern, action);
		};
		/**
		 * a shortcut for 'Rena().thenPass()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenPass()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.thenPass = function(pattern) {
			return new Rena().thenPass(pattern);
		};
		/**
		 * a shortcut for 'Rena().thenInt()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenInt()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.thenInt = function(pattern) {
			return new Rena().thenInt(pattern);
		};
		/**
		 * a shortcut for 'Rena().thenFloat()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenFloat()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.thenFloat = function(pattern) {
			return new Rena().thenFloat(pattern);
		};
		/**
		 * a shortcut for 'Rena().br()'.
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().br()'のショートカットです。
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.br = function() {
			return new Rena().br();
		};
		/**
		 * a shortcut for 'Rena().isEnd()'.
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().isEnd()'のショートカットです。
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.isEnd = function() {
			return new Rena().isEnd();
		};
		/**
		 * a shortcut for 'Rena().equalsId()'.
		 * @param {String} id identifier to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().equalsId()'のショートカットです。
		 * @param {String} id マッチする識別子
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.equalsId = function(id) {
			return new Rena().equalsId(id);
		};
		/**
		 * a shortcut for 'Rena().real()'.
		 * @param {Boolean} signum matches sign if signum is true
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().real()'のショートカットです。
		 * @param {Boolean} signum trueのとき符号にもマッチさせる
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.real = function(signum) {
			return new Rena().real(signum);
		};
		/**
		 * a shortcut for 'Rena().or()'.
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().or()'のショートカットです。
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.or = function() {
			var res = new Rena(),
				args = Array.prototype.slice.call(arguments);
			return res.or.apply(res, args);
		};
		/**
		 * a shortcut for 'Rena().thenMaybe()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenMaybe()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Function} action 呼び出されるアクション
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.maybe = function(pattern, action) {
			return new Rena().thenMaybe(pattern, action);
		};
		/**
		 * a shortcut for 'Rena().thenTimes()'.
		 * @param {Number} countmin minimum of repetation
		 * @param {Number} countmax maximum of repetation
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenTimes()'のショートカットです。
		 * @param {Number} countmin 繰り返しの最小数
		 * @param {Number} countmax 繰り返しの最大数
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Function} action 呼び出されるアクション
		 * @param {Object} init 属性の初期値
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.times = function(countmin, countmax, pattern, action, init) {
			return new Rena().thenTimes(countmin, countmax, pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().thenAtLeast()'.
		 * @param {Number} count minimum of repetation
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenAtLeast()'のショートカットです。
		 * @param {Number} count 繰り返しの最小数
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Function} action 呼び出されるアクション
		 * @param {Object} init 属性の初期値
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.atLeast = function(count, pattern, action, init) {
			return new Rena().thenAtLeast(count, pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().thenAtMost()'.
		 * @param {Number} count maximum of repetation
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenAtMost()'のショートカットです。
		 * @param {Number} count 繰り返しの最大数
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Function} action 呼び出されるアクション
		 * @param {Object} init 属性の初期値
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.atMost = function(count, pattern, action, init) {
			return new Rena().thenAtMost(count, pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().thenZeroOrMore()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenZeroOrMore()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Function} action 呼び出されるアクション
		 * @param {Object} init 属性の初期値
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.zeroOrMore = function(pattern, action, init) {
			return new Rena().thenZeroOrMore(pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().thenOneOrMore()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenOneOrMore()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Function} action 呼び出されるアクション
		 * @param {Object} init 属性の初期値
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.oneOrMore = function(pattern, action, init) {
			return new Rena().thenOneOrMore(pattern, action, init);
		};
		/**
		 * a shortcut for 'Rena().thenDelimit()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Object} delimiter a pattern of delimiter
		 * @param {Function} action an action to be invoked
		 * @param {Object} init an initial attribute
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().thenDelimit()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Object} delimiter デリミタのパターン
		 * @param {Function} action 呼び出されるアクション
		 * @param {Object} init 属性の初期値
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.delimit = function(pattern, delimiter, action, init) {
			return new Rena().thenDelimit(pattern, delimiter, action, init);
		};
		/**
		 * a shortcut for 'Rena().timesArray()'.
		 * @param {Number} countmin minimum of repetation
		 * @param {Number} countmax maximum of repetation
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().timesArray()'のショートカットです。
		 * @param {Number} countmin 繰り返しの最小数
		 * @param {Number} countmax 繰り返しの最大数
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.timesArray = function(countmin, countmax, pattern) {
			return new Rena().timesArray(countmin, countmax, pattern);
		};
		/**
		 * a shortcut for 'Rena().atLeastArray()'.
		 * @param {Number} count minimum of repetation
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().atLeastArray()'のショートカットです。
		 * @param {Number} count 繰り返しの最小数
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.atLeastArray = function(count, pattern) {
			return new Rena().atLeastArray(count, pattern);
		};
		/**
		 * a shortcut for 'Rena().atMostArray()'.
		 * @ja
		 * 'Rena().atMostArray()'のショートカットです。
		 * @param {Number} count 繰り返しの最大数
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.atMostArray = function(count, pattern) {
			return new Rena().atMostArray(count, pattern);
		};
		/**
		 * a shortcut for 'Rena().zeroOrMoreArray()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().zeroOrMoreArray()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.zeroOrMoreArray = function(pattern) {
			return new Rena().zeroOrMoreArray(pattern);
		};
		/**
		 * a shortcut for 'Rena().oneOrMoreArray()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().oneOrMoreArray()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.oneOrMoreArray = function(pattern) {
			return new Rena().oneOrMoreArray(pattern);
		};
		/**
		 * a shortcut for 'Rena().delimitArray()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Object} delimiter a pattern of delimiter
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().delimitArray()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Object} delimiter デリミタのパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.delimitArray = function(pattern, delimiter) {
			return new Rena().delimitArray(pattern, delimiter);
		};
		/**
		 * a shortcut for 'Rena().lookahead()'.
		 * @param {Object} pattern a pattern to match
		 * @param {Boolean} positive succeed when the pattern does not match if this value is falsy
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().lookahead()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @param {Boolean} positive trueのとき先読みが一致したときマッチ、falsenのとき先読みが一致しないときマッチ
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.lookahead = function(pattern, positive) {
			return new Rena().lookahead(pattern, positive);
		};
		/**
		 * a shortcut for 'Rena().lookaheadNot()'.
		 * @param {Object} pattern a pattern to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().lookaheadNot()'のショートカットです。
		 * @param {Object} pattern マッチさせるパターン
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.lookaheadNot = function(pattern) {
			return new Rena().lookaheadNot(pattern);
		};
		/**
		 * a shortcut for 'Rena().cond()'.
		 * @param {Function} cond the condition
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().cond()'のショートカットです。
		 * @param {Function} cond 条件
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.cond = function(pattern) {
			return new Rena().cond(pattern);
		};
		/**
		 * a shortcut for 'Rena().passAll()'.
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().passAll()'のショートカットです。
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.passAll = function() {
			return new Rena().passAll();
		};
		/**
		 * a shortcut for 'Rena().attr()'.
		 * @param {Object} attr an attribute
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().attr()'のショートカットです。
		 * @param {Object} attr セットする属性
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.attr = function(attr) {
			return new Rena().attr(attr);
		};
		/**
		 * a shortcut for 'Rena().action()'.
		 * @param {Object} action an action
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().action()'のショートカットです。
		 * @param {Object} action 実行するアクション
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.action = function(action) {
			return new Rena().action(action);
		};
		/**
		 * a shortcut for 'Rena().key()'.
		 * @param {String} word a keyword to be matched
		 * @param {Trie} trie a trie tree to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().key()'のショートカットです。
		 * @param {String} word マッチさせるキーワード
		 * @param {Trie} trie キーワードの集合
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.key = function(word, trie) {
			return new Rena().key(word, trie);
		};
		/**
		 * a shortcut for 'Rena().notKey()'.
		 * @param {Trie} trie a trie tree to match
		 * @return {Rena} new instance
		 * @ja
		 * 'Rena().notKey()'のショートカットです。
		 * @param {Trie} trie キーワードの集合
		 * @return {Rena} 新しいインスタンス
		 */
		Rena.notKey = function(trie) {
			return new Rena().notKey(trie);
		};
		Rena.pass = function() {};
		/**
		 * sets the pattern to be ignored.
		 * @param {Object} pattern a pattern to be ignored
		 * @param {RenaModule} this Rena module
		 * @ja
		 * 無視されるパターンをセットします。
		 * @param {Object} pattern 無視されるパターン
		 * @param {RenaModule} this このモジュール
		 */
		Rena.ignoreDefault = function(pattern) {
			Rena._ignore = pattern ? wrap(pattern) : null;
			return Rena;
		};
		Rena.ignoreDefault(null);
		/**
		 * sets the pattern to be ignored locally.
		 * @param {Object} pattern a pattern to be ignored
		 * @ja
		 * 局所的に無視されるパターンをセットします。
		 * @param {Object} pattern 無視されるパターン
		 */
		Rena.ignore = function(pattern) {
			return new Rena(undef, undef, pattern);
		};
		/**
		 * sets the keywords.
		 * @ja
		 * キーワードをセットします。
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
		/*
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
		/*
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
		 * @ja
		 * 最初の引数を返す関数です。
		 */
		Rena.I = function(x) { return x; };
		/**
		 * a function which returns first argument.
		 * @ja
		 * 最初の引数を返す関数です。
		 */
		Rena.first = function(x) { return x; };
		/**
		 * a function which returns second argument.
		 * @ja
		 * 2番目の引数を返す関数です。
		 */
		Rena.SK = function(x, y) { return y; };
		/**
		 * a function which returns second argument.
		 * @ja
		 * 2番目の引数を返す関数です。
		 */
		Rena.F = function(x, y) { return y; };
		/**
		 * a function which returns second argument.
		 * @ja
		 * 2番目の引数を返す関数です。
		 */
		Rena.second = function(x, y) { return y; };
		/**
		 * a fixed point combinator.
		 * @ja
		 * 関数の戻り値を引数に与える関数です。  
		 * 自分を再帰的に定義するときに使用します。
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
		 * <a href="http://okmij.org/ftp/Computation/fixed-point-combinators.html">http://okmij.org/ftp/Computation/fixed-point-combinators.html</a>
		 * @ja
		 * 関数の戻り値を引数に与える関数です。  
		 * 自分を再帰的に定義するときに使用します。
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
		 * @ja
		 * Rena.Yn()のエイリアスです。
		 */
		Rena.letrec = function() {
			var args = Array.prototype.slice.call(arguments);
			return Rena.Yn.apply(null, args);
		}
		/**
		 * creates the keywords.
		 * @return {Trie} a trie tree of keywords
		 * @ja
		 * キーワードの集合を生成します。
		 * @return {Trie} キーワードの集合
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
		/*
		 * define operator grammar.
		 * @param {Array} settings
		 * @return {Rena} Rena object of the operator grammar
		 */
		Rena.operatorGrammar = function(settings) {
			var option,
				grammar = [],
				i;
			function repeatGrammar(i, iNext) {
				var j,
					right = [];
				for(j in option[i].operators) {
					if(option[i].operators.hasOwnProperty(j)) {
						right.push(Rena.key(j).t(grammar[iNext], (function(j) {
							return function(x, a, b) {
								return option[i].operators[j](b, a);
							};
						})(j)));
					}
				}
				return right;
			}
			function repeatGrammarPre(i) {
				var j,
					right = [];
				for(j in option[i].operators) {
					if(option[i].operators.hasOwnProperty(j)) {
						right.push(Rena.key(j).t(grammar[i], (function(j) {
							return function(x, a, b) {
								return option[i].operators[j](a);
							}
						})(j)));
					}
				}
				return right;
			}
			function repeatGrammarPost(i) {
				var j,
					right = [];
				for(j in option[i].operators) {
					if(option[i].operators.hasOwnProperty(j)) {
						right.push(Rena.key(j).action(option[i].operators[j]));
					}
				}
				return right;
			}
			if(isArray(settings)) {
				option = settings;
			} else {
				option = Array.prototype.slice.call(arguments);
			}
			if(option.length === 0) {
				throw new Error("at least one element required");
			}
			for(i = 0; i < option.length; i++) {
				grammar[i] = new Rena();
				if(option[i].name) {
					grammar[option[i].name] = grammar[i];
				}
				
			}
			for(i = 0; i < option.length; i++) {
				if(option[i].grammar) {
					grammar[i].t(option[i].grammar(grammar));
				} else {
					if(i + 1 >= option.length) {
						throw new Error("element required");
					}
					switch(option[i].associative) {
					case "left":
						grammar[i].t(grammar[i + 1]).thenZeroOrMore(Rena.or(repeatGrammar(i, i + 1)));
						break;
					case "right":
						grammar[i].t(grammar[i + 1]).thenMaybe(Rena.or(repeatGrammar(i, i)));
						break;
					case "pre":
						grammar[i].or(Rena.or(repeatGrammarPre(i)), grammar[i + 1]);
						break;
					case "post":
						grammar[i].t(grammar[i + 1]).thenZeroOrMore(Rena.or(repeatGrammarPost(i)));
						break;
					default:
						throw new Error("invalid associative");
					}
				}
			}
			return grammar[0];
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
