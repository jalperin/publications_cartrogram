// Version 1.0.6 cartogram-chart - https://github.com/vasturiano/cartogram-chart
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Cartogram = factory());
}(this, (function () { 'use strict';

  var xhtml = "http://www.w3.org/1999/xhtml";

  var namespaces = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: xhtml,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  function namespace(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
  }

  function creatorInherit(name) {
    return function() {
      var document = this.ownerDocument,
          uri = this.namespaceURI;
      return uri === xhtml && document.documentElement.namespaceURI === xhtml
          ? document.createElement(name)
          : document.createElementNS(uri, name);
    };
  }

  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }

  function creator(name) {
    var fullname = namespace(name);
    return (fullname.local
        ? creatorFixed
        : creatorInherit)(fullname);
  }

  function none() {}

  function selector(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }

  function selection_select(select) {
    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function empty() {
    return [];
  }

  function selectorAll(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }

  function selection_selectAll(select) {
    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }

    return new Selection(subgroups, parents);
  }

  var matcher = function(selector) {
    return function() {
      return this.matches(selector);
    };
  };

  if (typeof document !== "undefined") {
    var element = document.documentElement;
    if (!element.matches) {
      var vendorMatches = element.webkitMatchesSelector
          || element.msMatchesSelector
          || element.mozMatchesSelector
          || element.oMatchesSelector;
      matcher = function(selector) {
        return function() {
          return vendorMatches.call(this, selector);
        };
      };
    }
  }

  var matcher$1 = matcher;

  function selection_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function sparse(update) {
    return new Array(update.length);
  }

  function selection_enter() {
    return new Selection(this._enter || this._groups.map(sparse), this._parents);
  }

  function EnterNode(parent, datum) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum;
  }

  EnterNode.prototype = {
    constructor: EnterNode,
    appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
    insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
    querySelector: function(selector) { return this._parent.querySelector(selector); },
    querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
  };

  function constant(x) {
    return function() {
      return x;
    };
  }

  var keyPrefix = "$"; // Protect against keys like “__proto__”.

  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0,
        node,
        groupLength = group.length,
        dataLength = data.length;

    // Put any non-null nodes that fit into update.
    // Put any null nodes into enter.
    // Put any remaining data into enter.
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Put any non-null nodes that don’t fit into exit.
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }

  function bindKey(parent, group, enter, update, exit, data, key) {
    var i,
        node,
        nodeByKeyValue = {},
        groupLength = group.length,
        dataLength = data.length,
        keyValues = new Array(groupLength),
        keyValue;

    // Compute the key for each node.
    // If multiple nodes have the same key, the duplicates are added to exit.
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
        if (keyValue in nodeByKeyValue) {
          exit[i] = node;
        } else {
          nodeByKeyValue[keyValue] = node;
        }
      }
    }

    // Compute the key for each datum.
    // If there a node associated with this key, join and add it to update.
    // If there is not (or the key is a duplicate), add it to enter.
    for (i = 0; i < dataLength; ++i) {
      keyValue = keyPrefix + key.call(parent, data[i], i, data);
      if (node = nodeByKeyValue[keyValue]) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue[keyValue] = null;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Add any remaining nodes that were not bound to data to exit.
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
        exit[i] = node;
      }
    }
  }

  function selection_data(value, key) {
    if (!value) {
      data = new Array(this.size()), j = -1;
      this.each(function(d) { data[++j] = d; });
      return data;
    }

    var bind = key ? bindKey : bindIndex,
        parents = this._parents,
        groups = this._groups;

    if (typeof value !== "function") value = constant(value);

    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j],
          group = groups[j],
          groupLength = group.length,
          data = value.call(parent, parent && parent.__data__, j, parents),
          dataLength = data.length,
          enterGroup = enter[j] = new Array(dataLength),
          updateGroup = update[j] = new Array(dataLength),
          exitGroup = exit[j] = new Array(groupLength);

      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

      // Now connect the enter nodes to their following update node, such that
      // appendChild can insert the materialized enter node before this node,
      // rather than at the end of the parent node.
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength);
          previous._next = next || null;
        }
      }
    }

    update = new Selection(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }

  function selection_exit() {
    return new Selection(this._exit || this._groups.map(sparse), this._parents);
  }

  function selection_merge(selection$$1) {

    for (var groups0 = this._groups, groups1 = selection$$1._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Selection(merges, this._parents);
  }

  function selection_order() {

    for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
        if (node = group[i]) {
          if (next && next !== node.nextSibling) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }

    return this;
  }

  function selection_sort(compare) {
    if (!compare) compare = ascending;

    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }

    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }

    return new Selection(sortgroups, this._parents).order();
  }

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function selection_call() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }

  function selection_nodes() {
    var nodes = new Array(this.size()), i = -1;
    this.each(function() { nodes[++i] = this; });
    return nodes;
  }

  function selection_node() {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }

    return null;
  }

  function selection_size() {
    var size = 0;
    this.each(function() { ++size; });
    return size;
  }

  function selection_empty() {
    return !this.node();
  }

  function selection_each(callback) {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }

    return this;
  }

  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }

  function attrConstantNS(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }

  function attrFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }

  function attrFunctionNS(fullname, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }

  function selection_attr(name, value) {
    var fullname = namespace(name);

    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local
          ? node.getAttributeNS(fullname.space, fullname.local)
          : node.getAttribute(fullname);
    }

    return this.each((value == null
        ? (fullname.local ? attrRemoveNS : attrRemove) : (typeof value === "function"
        ? (fullname.local ? attrFunctionNS : attrFunction)
        : (fullname.local ? attrConstantNS : attrConstant)))(fullname, value));
  }

  function defaultView(node) {
    return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
        || (node.document && node) // node is a Window
        || node.defaultView; // node is a Document
  }

  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }

  function styleFunction(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }

  function selection_style(name, value, priority) {
    return arguments.length > 1
        ? this.each((value == null
              ? styleRemove : typeof value === "function"
              ? styleFunction
              : styleConstant)(name, value, priority == null ? "" : priority))
        : styleValue(this.node(), name);
  }

  function styleValue(node, name) {
    return node.style.getPropertyValue(name)
        || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
  }

  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }

  function propertyConstant(name, value) {
    return function() {
      this[name] = value;
    };
  }

  function propertyFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }

  function selection_property(name, value) {
    return arguments.length > 1
        ? this.each((value == null
            ? propertyRemove : typeof value === "function"
            ? propertyFunction
            : propertyConstant)(name, value))
        : this.node()[name];
  }

  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }

  function classList(node) {
    return node.classList || new ClassList(node);
  }

  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }

  ClassList.prototype = {
    add: function(name) {
      var i = this._names.indexOf(name);
      if (i < 0) {
        this._names.push(name);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    remove: function(name) {
      var i = this._names.indexOf(name);
      if (i >= 0) {
        this._names.splice(i, 1);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    contains: function(name) {
      return this._names.indexOf(name) >= 0;
    }
  };

  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }

  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }

  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }

  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }

  function classedFunction(names, value) {
    return function() {
      (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }

  function selection_classed(name, value) {
    var names = classArray(name + "");

    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }

    return this.each((typeof value === "function"
        ? classedFunction : value
        ? classedTrue
        : classedFalse)(names, value));
  }

  function textRemove() {
    this.textContent = "";
  }

  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }

  function selection_text(value) {
    return arguments.length
        ? this.each(value == null
            ? textRemove : (typeof value === "function"
            ? textFunction
            : textConstant)(value))
        : this.node().textContent;
  }

  function htmlRemove() {
    this.innerHTML = "";
  }

  function htmlConstant(value) {
    return function() {
      this.innerHTML = value;
    };
  }

  function htmlFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }

  function selection_html(value) {
    return arguments.length
        ? this.each(value == null
            ? htmlRemove : (typeof value === "function"
            ? htmlFunction
            : htmlConstant)(value))
        : this.node().innerHTML;
  }

  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }

  function selection_raise() {
    return this.each(raise);
  }

  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }

  function selection_lower() {
    return this.each(lower);
  }

  function selection_append(name) {
    var create = typeof name === "function" ? name : creator(name);
    return this.select(function() {
      return this.appendChild(create.apply(this, arguments));
    });
  }

  function constantNull() {
    return null;
  }

  function selection_insert(name, before) {
    var create = typeof name === "function" ? name : creator(name),
        select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
    return this.select(function() {
      return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }

  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }

  function selection_remove() {
    return this.each(remove);
  }

  function selection_cloneShallow() {
    return this.parentNode.insertBefore(this.cloneNode(false), this.nextSibling);
  }

  function selection_cloneDeep() {
    return this.parentNode.insertBefore(this.cloneNode(true), this.nextSibling);
  }

  function selection_clone(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }

  function selection_datum(value) {
    return arguments.length
        ? this.property("__data__", value)
        : this.node().__data__;
  }

  var filterEvents = {};

  var event = null;

  if (typeof document !== "undefined") {
    var element$1 = document.documentElement;
    if (!("onmouseenter" in element$1)) {
      filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
    }
  }

  function filterContextListener(listener, index, group) {
    listener = contextListener(listener, index, group);
    return function(event) {
      var related = event.relatedTarget;
      if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
        listener.call(this, event);
      }
    };
  }

  function contextListener(listener, index, group) {
    return function(event1) {
      var event0 = event; // Events can be reentrant (e.g., focus).
      event = event1;
      try {
        listener.call(this, this.__data__, index, group);
      } finally {
        event = event0;
      }
    };
  }

  function parseTypenames(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return {type: t, name: name};
    });
  }

  function onRemove(typename) {
    return function() {
      var on = this.__on;
      if (!on) return;
      for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
        if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
        } else {
          on[++i] = o;
        }
      }
      if (++i) on.length = i;
      else delete this.__on;
    };
  }

  function onAdd(typename, value, capture) {
    var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
    return function(d, i, group) {
      var on = this.__on, o, listener = wrap(value, i, group);
      if (on) for (var j = 0, m = on.length; j < m; ++j) {
        if ((o = on[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
          this.addEventListener(o.type, o.listener = listener, o.capture = capture);
          o.value = value;
          return;
        }
      }
      this.addEventListener(typename.type, listener, capture);
      o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
      if (!on) this.__on = [o];
      else on.push(o);
    };
  }

  function selection_on(typename, value, capture) {
    var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;

    if (arguments.length < 2) {
      var on = this.node().__on;
      if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
        for (i = 0, o = on[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }

    on = value ? onAdd : onRemove;
    if (capture == null) capture = false;
    for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
    return this;
  }

  function dispatchEvent(node, type, params) {
    var window = defaultView(node),
        event = window.CustomEvent;

    if (typeof event === "function") {
      event = new event(type, params);
    } else {
      event = window.document.createEvent("Event");
      if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type, false, false);
    }

    node.dispatchEvent(event);
  }

  function dispatchConstant(type, params) {
    return function() {
      return dispatchEvent(this, type, params);
    };
  }

  function dispatchFunction(type, params) {
    return function() {
      return dispatchEvent(this, type, params.apply(this, arguments));
    };
  }

  function selection_dispatch(type, params) {
    return this.each((typeof params === "function"
        ? dispatchFunction
        : dispatchConstant)(type, params));
  }

  var root = [null];

  function Selection(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }

  function selection() {
    return new Selection([[document.documentElement]], root);
  }

  Selection.prototype = selection.prototype = {
    constructor: Selection,
    select: selection_select,
    selectAll: selection_selectAll,
    filter: selection_filter,
    data: selection_data,
    enter: selection_enter,
    exit: selection_exit,
    merge: selection_merge,
    order: selection_order,
    sort: selection_sort,
    call: selection_call,
    nodes: selection_nodes,
    node: selection_node,
    size: selection_size,
    empty: selection_empty,
    each: selection_each,
    attr: selection_attr,
    style: selection_style,
    property: selection_property,
    classed: selection_classed,
    text: selection_text,
    html: selection_html,
    raise: selection_raise,
    lower: selection_lower,
    append: selection_append,
    insert: selection_insert,
    remove: selection_remove,
    clone: selection_clone,
    datum: selection_datum,
    on: selection_on,
    dispatch: selection_dispatch
  };

  function select(selector) {
    return typeof selector === "string"
        ? new Selection([[document.querySelector(selector)]], [document.documentElement])
        : new Selection([[selector]], root);
  }

  var noop = {value: function() {}};

  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || (t in _)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }

  function Dispatch(_) {
    this._ = _;
  }

  function parseTypenames$1(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return {type: t, name: name};
    });
  }

  Dispatch.prototype = dispatch.prototype = {
    constructor: Dispatch,
    on: function(typename, callback) {
      var _ = this._,
          T = parseTypenames$1(typename + "", _),
          t,
          i = -1,
          n = T.length;

      // If no callback was specified, return the callback of the given type and name.
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
        return;
      }

      // If a type was specified, set the callback for the given type and name.
      // Otherwise, if a null callback was specified, remove callbacks of the given name.
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
      }

      return this;
    },
    copy: function() {
      var copy = {}, _ = this._;
      for (var t in _) copy[t] = _[t].slice();
      return new Dispatch(copy);
    },
    call: function(type, that) {
      if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    },
    apply: function(type, that, args) {
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    }
  };

  function get(type, name) {
    for (var i = 0, n = type.length, c; i < n; ++i) {
      if ((c = type[i]).name === name) {
        return c.value;
      }
    }
  }

  function set(type, name, callback) {
    for (var i = 0, n = type.length; i < n; ++i) {
      if (type[i].name === name) {
        type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
        break;
      }
    }
    if (callback != null) type.push({name: name, value: callback});
    return type;
  }

  var frame = 0, // is an animation frame pending?
      timeout = 0, // is a timeout pending?
      interval = 0, // are any timers active?
      pokeDelay = 1000, // how frequently we check for clock skew
      taskHead,
      taskTail,
      clockLast = 0,
      clockNow = 0,
      clockSkew = 0,
      clock = typeof performance === "object" && performance.now ? performance : Date,
      setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

  function now() {
    return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
  }

  function clearNow() {
    clockNow = 0;
  }

  function Timer() {
    this._call =
    this._time =
    this._next = null;
  }

  Timer.prototype = timer.prototype = {
    constructor: Timer,
    restart: function(callback, delay, time) {
      if (typeof callback !== "function") throw new TypeError("callback is not a function");
      time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
      if (!this._next && taskTail !== this) {
        if (taskTail) taskTail._next = this;
        else taskHead = this;
        taskTail = this;
      }
      this._call = callback;
      this._time = time;
      sleep();
    },
    stop: function() {
      if (this._call) {
        this._call = null;
        this._time = Infinity;
        sleep();
      }
    }
  };

  function timer(callback, delay, time) {
    var t = new Timer;
    t.restart(callback, delay, time);
    return t;
  }

  function timerFlush() {
    now(); // Get the current time, if not already set.
    ++frame; // Pretend we’ve set an alarm, if we haven’t already.
    var t = taskHead, e;
    while (t) {
      if ((e = clockNow - t._time) >= 0) t._call.call(null, e);
      t = t._next;
    }
    --frame;
  }

  function wake() {
    clockNow = (clockLast = clock.now()) + clockSkew;
    frame = timeout = 0;
    try {
      timerFlush();
    } finally {
      frame = 0;
      nap();
      clockNow = 0;
    }
  }

  function poke() {
    var now = clock.now(), delay = now - clockLast;
    if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
  }

  function nap() {
    var t0, t1 = taskHead, t2, time = Infinity;
    while (t1) {
      if (t1._call) {
        if (time > t1._time) time = t1._time;
        t0 = t1, t1 = t1._next;
      } else {
        t2 = t1._next, t1._next = null;
        t1 = t0 ? t0._next = t2 : taskHead = t2;
      }
    }
    taskTail = t0;
    sleep(time);
  }

  function sleep(time) {
    if (frame) return; // Soonest alarm already set, or will be.
    if (timeout) timeout = clearTimeout(timeout);
    var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
    if (delay > 24) {
      if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
      if (interval) interval = clearInterval(interval);
    } else {
      if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }

  function timeout$1(callback, delay, time) {
    var t = new Timer;
    delay = delay == null ? 0 : +delay;
    t.restart(function(elapsed) {
      t.stop();
      callback(elapsed + delay);
    }, delay, time);
    return t;
  }

  var emptyOn = dispatch("start", "end", "interrupt");
  var emptyTween = [];

  var CREATED = 0;
  var SCHEDULED = 1;
  var STARTING = 2;
  var STARTED = 3;
  var RUNNING = 4;
  var ENDING = 5;
  var ENDED = 6;

  function schedule(node, name, id, index, group, timing) {
    var schedules = node.__transition;
    if (!schedules) node.__transition = {};
    else if (id in schedules) return;
    create$1(node, id, {
      name: name,
      index: index, // For context during callback.
      group: group, // For context during callback.
      on: emptyOn,
      tween: emptyTween,
      time: timing.time,
      delay: timing.delay,
      duration: timing.duration,
      ease: timing.ease,
      timer: null,
      state: CREATED
    });
  }

  function init(node, id) {
    var schedule = get$1(node, id);
    if (schedule.state > CREATED) throw new Error("too late; already scheduled");
    return schedule;
  }

  function set$1(node, id) {
    var schedule = get$1(node, id);
    if (schedule.state > STARTING) throw new Error("too late; already started");
    return schedule;
  }

  function get$1(node, id) {
    var schedule = node.__transition;
    if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
    return schedule;
  }

  function create$1(node, id, self) {
    var schedules = node.__transition,
        tween;

    // Initialize the self timer when the transition is created.
    // Note the actual delay is not known until the first callback!
    schedules[id] = self;
    self.timer = timer(schedule, 0, self.time);

    function schedule(elapsed) {
      self.state = SCHEDULED;
      self.timer.restart(start, self.delay, self.time);

      // If the elapsed delay is less than our first sleep, start immediately.
      if (self.delay <= elapsed) start(elapsed - self.delay);
    }

    function start(elapsed) {
      var i, j, n, o;

      // If the state is not SCHEDULED, then we previously errored on start.
      if (self.state !== SCHEDULED) return stop();

      for (i in schedules) {
        o = schedules[i];
        if (o.name !== self.name) continue;

        // While this element already has a starting transition during this frame,
        // defer starting an interrupting transition until that transition has a
        // chance to tick (and possibly end); see d3/d3-transition#54!
        if (o.state === STARTED) return timeout$1(start);

        // Interrupt the active transition, if any.
        // Dispatch the interrupt event.
        if (o.state === RUNNING) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("interrupt", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }

        // Cancel any pre-empted transitions. No interrupt event is dispatched
        // because the cancelled transitions never started. Note that this also
        // removes this transition from the pending list!
        else if (+i < id) {
          o.state = ENDED;
          o.timer.stop();
          delete schedules[i];
        }
      }

      // Defer the first tick to end of the current frame; see d3/d3#1576.
      // Note the transition may be canceled after start and before the first tick!
      // Note this must be scheduled before the start event; see d3/d3-transition#16!
      // Assuming this is successful, subsequent callbacks go straight to tick.
      timeout$1(function() {
        if (self.state === STARTED) {
          self.state = RUNNING;
          self.timer.restart(tick, self.delay, self.time);
          tick(elapsed);
        }
      });

      // Dispatch the start event.
      // Note this must be done before the tween are initialized.
      self.state = STARTING;
      self.on.call("start", node, node.__data__, self.index, self.group);
      if (self.state !== STARTING) return; // interrupted
      self.state = STARTED;

      // Initialize the tween, deleting null tween.
      tween = new Array(n = self.tween.length);
      for (i = 0, j = -1; i < n; ++i) {
        if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
          tween[++j] = o;
        }
      }
      tween.length = j + 1;
    }

    function tick(elapsed) {
      var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
          i = -1,
          n = tween.length;

      while (++i < n) {
        tween[i].call(null, t);
      }

      // Dispatch the end event.
      if (self.state === ENDING) {
        self.on.call("end", node, node.__data__, self.index, self.group);
        stop();
      }
    }

    function stop() {
      self.state = ENDED;
      self.timer.stop();
      delete schedules[id];
      for (var i in schedules) return; // eslint-disable-line no-unused-vars
      delete node.__transition;
    }
  }

  function interrupt(node, name) {
    var schedules = node.__transition,
        schedule$$1,
        active,
        empty = true,
        i;

    if (!schedules) return;

    name = name == null ? null : name + "";

    for (i in schedules) {
      if ((schedule$$1 = schedules[i]).name !== name) { empty = false; continue; }
      active = schedule$$1.state > STARTING && schedule$$1.state < ENDING;
      schedule$$1.state = ENDED;
      schedule$$1.timer.stop();
      if (active) schedule$$1.on.call("interrupt", node, node.__data__, schedule$$1.index, schedule$$1.group);
      delete schedules[i];
    }

    if (empty) delete node.__transition;
  }

  function selection_interrupt(name) {
    return this.each(function() {
      interrupt(this, name);
    });
  }

  function define(constructor, factory, prototype) {
    constructor.prototype = factory.prototype = prototype;
    prototype.constructor = constructor;
  }

  function extend(parent, definition) {
    var prototype = Object.create(parent.prototype);
    for (var key in definition) prototype[key] = definition[key];
    return prototype;
  }

  function Color() {}

  var darker = 0.7;
  var brighter = 1 / darker;

  var reI = "\\s*([+-]?\\d+)\\s*",
      reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
      reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
      reHex3 = /^#([0-9a-f]{3})$/,
      reHex6 = /^#([0-9a-f]{6})$/,
      reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
      reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
      reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
      reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
      reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
      reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

  var named = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32
  };

  define(Color, color, {
    displayable: function() {
      return this.rgb().displayable();
    },
    hex: function() {
      return this.rgb().hex();
    },
    toString: function() {
      return this.rgb() + "";
    }
  });

  function color(format) {
    var m;
    format = (format + "").trim().toLowerCase();
    return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), new Rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1)) // #f00
        : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
        : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
        : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
        : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
        : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
        : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
        : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
        : named.hasOwnProperty(format) ? rgbn(named[format])
        : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
        : null;
  }

  function rgbn(n) {
    return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
  }

  function rgba(r, g, b, a) {
    if (a <= 0) r = g = b = NaN;
    return new Rgb(r, g, b, a);
  }

  function rgbConvert(o) {
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Rgb;
    o = o.rgb();
    return new Rgb(o.r, o.g, o.b, o.opacity);
  }

  function rgb(r, g, b, opacity) {
    return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
  }

  function Rgb(r, g, b, opacity) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Rgb, rgb, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    rgb: function() {
      return this;
    },
    displayable: function() {
      return (0 <= this.r && this.r <= 255)
          && (0 <= this.g && this.g <= 255)
          && (0 <= this.b && this.b <= 255)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    hex: function() {
      return "#" + hex(this.r) + hex(this.g) + hex(this.b);
    },
    toString: function() {
      var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
      return (a === 1 ? "rgb(" : "rgba(")
          + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
          + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
          + Math.max(0, Math.min(255, Math.round(this.b) || 0))
          + (a === 1 ? ")" : ", " + a + ")");
    }
  }));

  function hex(value) {
    value = Math.max(0, Math.min(255, Math.round(value) || 0));
    return (value < 16 ? "0" : "") + value.toString(16);
  }

  function hsla(h, s, l, a) {
    if (a <= 0) h = s = l = NaN;
    else if (l <= 0 || l >= 1) h = s = NaN;
    else if (s <= 0) h = NaN;
    return new Hsl(h, s, l, a);
  }

  function hslConvert(o) {
    if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Hsl;
    if (o instanceof Hsl) return o;
    o = o.rgb();
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        min = Math.min(r, g, b),
        max = Math.max(r, g, b),
        h = NaN,
        s = max - min,
        l = (max + min) / 2;
    if (s) {
      if (r === max) h = (g - b) / s + (g < b) * 6;
      else if (g === max) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max + min : 2 - max - min;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return new Hsl(h, s, l, o.opacity);
  }

  function hsl(h, s, l, opacity) {
    return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
  }

  function Hsl(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Hsl, hsl, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = this.h % 360 + (this.h < 0) * 360,
          s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
          l = this.l,
          m2 = l + (l < 0.5 ? l : 1 - l) * s,
          m1 = 2 * l - m2;
      return new Rgb(
        hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
        hsl2rgb(h, m1, m2),
        hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
        this.opacity
      );
    },
    displayable: function() {
      return (0 <= this.s && this.s <= 1 || isNaN(this.s))
          && (0 <= this.l && this.l <= 1)
          && (0 <= this.opacity && this.opacity <= 1);
    }
  }));

  /* From FvD 13.37, CSS Color Module Level 3 */
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60
        : h < 180 ? m2
        : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
        : m1) * 255;
  }

  var deg2rad = Math.PI / 180;
  var rad2deg = 180 / Math.PI;

  // https://beta.observablehq.com/@mbostock/lab-and-rgb
  var K = 18,
      Xn = 0.96422,
      Yn = 1,
      Zn = 0.82521,
      t0 = 4 / 29,
      t1 = 6 / 29,
      t2 = 3 * t1 * t1,
      t3 = t1 * t1 * t1;

  function labConvert(o) {
    if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
    if (o instanceof Hcl) {
      if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
      var h = o.h * deg2rad;
      return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
    }
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = rgb2lrgb(o.r),
        g = rgb2lrgb(o.g),
        b = rgb2lrgb(o.b),
        y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn), x, z;
    if (r === g && g === b) x = z = y; else {
      x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
      z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
    }
    return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
  }

  function lab(l, a, b, opacity) {
    return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
  }

  function Lab(l, a, b, opacity) {
    this.l = +l;
    this.a = +a;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Lab, lab, extend(Color, {
    brighter: function(k) {
      return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    darker: function(k) {
      return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    rgb: function() {
      var y = (this.l + 16) / 116,
          x = isNaN(this.a) ? y : y + this.a / 500,
          z = isNaN(this.b) ? y : y - this.b / 200;
      x = Xn * lab2xyz(x);
      y = Yn * lab2xyz(y);
      z = Zn * lab2xyz(z);
      return new Rgb(
        lrgb2rgb( 3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
        lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
        lrgb2rgb( 0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
        this.opacity
      );
    }
  }));

  function xyz2lab(t) {
    return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }

  function lab2xyz(t) {
    return t > t1 ? t * t * t : t2 * (t - t0);
  }

  function lrgb2rgb(x) {
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  }

  function rgb2lrgb(x) {
    return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  function hclConvert(o) {
    if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
    if (!(o instanceof Lab)) o = labConvert(o);
    if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0, o.l, o.opacity);
    var h = Math.atan2(o.b, o.a) * rad2deg;
    return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
  }

  function hcl(h, c, l, opacity) {
    return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
  }

  function Hcl(h, c, l, opacity) {
    this.h = +h;
    this.c = +c;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Hcl, hcl, extend(Color, {
    brighter: function(k) {
      return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
    },
    darker: function(k) {
      return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
    },
    rgb: function() {
      return labConvert(this).rgb();
    }
  }));

  var A = -0.14861,
      B = +1.78277,
      C = -0.29227,
      D = -0.90649,
      E = +1.97294,
      ED = E * D,
      EB = E * B,
      BC_DA = B * C - D * A;

  function cubehelixConvert(o) {
    if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
        bl = b - l,
        k = (E * (g - l) - C * bl) / D,
        s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
        h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
    return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
  }

  function cubehelix(h, s, l, opacity) {
    return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
  }

  function Cubehelix(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Cubehelix, cubehelix, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
          l = +this.l,
          a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
          cosh = Math.cos(h),
          sinh = Math.sin(h);
      return new Rgb(
        255 * (l + a * (A * cosh + B * sinh)),
        255 * (l + a * (C * cosh + D * sinh)),
        255 * (l + a * (E * cosh)),
        this.opacity
      );
    }
  }));

  function constant$1(x) {
    return function() {
      return x;
    };
  }

  function linear(a, d) {
    return function(t) {
      return a + t * d;
    };
  }

  function exponential(a, b, y) {
    return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
      return Math.pow(a + t * b, y);
    };
  }

  function gamma(y) {
    return (y = +y) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y) : constant$1(isNaN(a) ? b : a);
    };
  }

  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant$1(isNaN(a) ? b : a);
  }

  var rgb$1 = (function rgbGamma(y) {
    var color$$1 = gamma(y);

    function rgb$$1(start, end) {
      var r = color$$1((start = rgb(start)).r, (end = rgb(end)).r),
          g = color$$1(start.g, end.g),
          b = color$$1(start.b, end.b),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.r = r(t);
        start.g = g(t);
        start.b = b(t);
        start.opacity = opacity(t);
        return start + "";
      };
    }

    rgb$$1.gamma = rgbGamma;

    return rgb$$1;
  })(1);

  function number(a, b) {
    return a = +a, b -= a, function(t) {
      return a + b * t;
    };
  }

  var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
      reB = new RegExp(reA.source, "g");

  function zero(b) {
    return function() {
      return b;
    };
  }

  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }

  function string(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
        am, // current match in a
        bm, // current match in b
        bs, // string preceding current number in b, if any
        i = -1, // index in s
        s = [], // string constants and placeholders
        q = []; // number interpolators

    // Coerce inputs to strings.
    a = a + "", b = b + "";

    // Interpolate pairs of numbers in a & b.
    while ((am = reA.exec(a))
        && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) { // a string precedes the next number in b
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs; // coalesce with previous string
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
        if (s[i]) s[i] += bm; // coalesce with previous string
        else s[++i] = bm;
      } else { // interpolate non-matching numbers
        s[++i] = null;
        q.push({i: i, x: number(am, bm)});
      }
      bi = reB.lastIndex;
    }

    // Add remains of b.
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }

    // Special optimization for only a single match.
    // Otherwise, interpolate each of the numbers and rejoin the string.
    return s.length < 2 ? (q[0]
        ? one(q[0].x)
        : zero(b))
        : (b = q.length, function(t) {
            for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
            return s.join("");
          });
  }

  var degrees = 180 / Math.PI;

  var identity = {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    skewX: 0,
    scaleX: 1,
    scaleY: 1
  };

  function decompose(a, b, c, d, e, f) {
    var scaleX, scaleY, skewX;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
      translateX: e,
      translateY: f,
      rotate: Math.atan2(b, a) * degrees,
      skewX: Math.atan(skewX) * degrees,
      scaleX: scaleX,
      scaleY: scaleY
    };
  }

  var cssNode,
      cssRoot,
      cssView,
      svgNode;

  function parseCss(value) {
    if (value === "none") return identity;
    if (!cssNode) cssNode = document.createElement("DIV"), cssRoot = document.documentElement, cssView = document.defaultView;
    cssNode.style.transform = value;
    value = cssView.getComputedStyle(cssRoot.appendChild(cssNode), null).getPropertyValue("transform");
    cssRoot.removeChild(cssNode);
    value = value.slice(7, -1).split(",");
    return decompose(+value[0], +value[1], +value[2], +value[3], +value[4], +value[5]);
  }

  function parseSvg(value) {
    if (value == null) return identity;
    if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svgNode.setAttribute("transform", value);
    if (!(value = svgNode.transform.baseVal.consolidate())) return identity;
    value = value.matrix;
    return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
  }

  function interpolateTransform(parse, pxComma, pxParen, degParen) {

    function pop(s) {
      return s.length ? s.pop() + " " : "";
    }

    function translate(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push("translate(", null, pxComma, null, pxParen);
        q.push({i: i - 4, x: number(xa, xb)}, {i: i - 2, x: number(ya, yb)});
      } else if (xb || yb) {
        s.push("translate(" + xb + pxComma + yb + pxParen);
      }
    }

    function rotate(a, b, s, q) {
      if (a !== b) {
        if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
        q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number(a, b)});
      } else if (b) {
        s.push(pop(s) + "rotate(" + b + degParen);
      }
    }

    function skewX(a, b, s, q) {
      if (a !== b) {
        q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number(a, b)});
      } else if (b) {
        s.push(pop(s) + "skewX(" + b + degParen);
      }
    }

    function scale(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push(pop(s) + "scale(", null, ",", null, ")");
        q.push({i: i - 4, x: number(xa, xb)}, {i: i - 2, x: number(ya, yb)});
      } else if (xb !== 1 || yb !== 1) {
        s.push(pop(s) + "scale(" + xb + "," + yb + ")");
      }
    }

    return function(a, b) {
      var s = [], // string constants and placeholders
          q = []; // number interpolators
      a = parse(a), b = parse(b);
      translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
      rotate(a.rotate, b.rotate, s, q);
      skewX(a.skewX, b.skewX, s, q);
      scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
      a = b = null; // gc
      return function(t) {
        var i = -1, n = q.length, o;
        while (++i < n) s[(o = q[i]).i] = o.x(t);
        return s.join("");
      };
    };
  }

  var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
  var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

  var rho = Math.SQRT2;

  function tweenRemove(id, name) {
    var tween0, tween1;
    return function() {
      var schedule$$1 = set$1(this, id),
          tween = schedule$$1.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = tween0 = tween;
        for (var i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1 = tween1.slice();
            tween1.splice(i, 1);
            break;
          }
        }
      }

      schedule$$1.tween = tween1;
    };
  }

  function tweenFunction(id, name, value) {
    var tween0, tween1;
    if (typeof value !== "function") throw new Error;
    return function() {
      var schedule$$1 = set$1(this, id),
          tween = schedule$$1.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = (tween0 = tween).slice();
        for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1[i] = t;
            break;
          }
        }
        if (i === n) tween1.push(t);
      }

      schedule$$1.tween = tween1;
    };
  }

  function transition_tween(name, value) {
    var id = this._id;

    name += "";

    if (arguments.length < 2) {
      var tween = get$1(this.node(), id).tween;
      for (var i = 0, n = tween.length, t; i < n; ++i) {
        if ((t = tween[i]).name === name) {
          return t.value;
        }
      }
      return null;
    }

    return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
  }

  function tweenValue(transition, name, value) {
    var id = transition._id;

    transition.each(function() {
      var schedule$$1 = set$1(this, id);
      (schedule$$1.value || (schedule$$1.value = {}))[name] = value.apply(this, arguments);
    });

    return function(node) {
      return get$1(node, id).value[name];
    };
  }

  function interpolate(a, b) {
    var c;
    return (typeof b === "number" ? number
        : b instanceof color ? rgb$1
        : (c = color(b)) ? (b = c, rgb$1)
        : string)(a, b);
  }

  function attrRemove$1(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS$1(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant$1(name, interpolate$$1, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = this.getAttribute(name);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value1);
    };
  }

  function attrConstantNS$1(fullname, interpolate$$1, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = this.getAttributeNS(fullname.space, fullname.local);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value1);
    };
  }

  function attrFunction$1(name, interpolate$$1, value$$1) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0, value1 = value$$1(this);
      if (value1 == null) return void this.removeAttribute(name);
      value0 = this.getAttribute(name);
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value10 = value1);
    };
  }

  function attrFunctionNS$1(fullname, interpolate$$1, value$$1) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0, value1 = value$$1(this);
      if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
      value0 = this.getAttributeNS(fullname.space, fullname.local);
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value10 = value1);
    };
  }

  function transition_attr(name, value$$1) {
    var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
    return this.attrTween(name, typeof value$$1 === "function"
        ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)(fullname, i, tweenValue(this, "attr." + name, value$$1))
        : value$$1 == null ? (fullname.local ? attrRemoveNS$1 : attrRemove$1)(fullname)
        : (fullname.local ? attrConstantNS$1 : attrConstant$1)(fullname, i, value$$1 + ""));
  }

  function attrTweenNS(fullname, value) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.setAttributeNS(fullname.space, fullname.local, i(t));
      };
    }
    tween._value = value;
    return tween;
  }

  function attrTween(name, value) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.setAttribute(name, i(t));
      };
    }
    tween._value = value;
    return tween;
  }

  function transition_attrTween(name, value) {
    var key = "attr." + name;
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    var fullname = namespace(name);
    return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
  }

  function delayFunction(id, value) {
    return function() {
      init(this, id).delay = +value.apply(this, arguments);
    };
  }

  function delayConstant(id, value) {
    return value = +value, function() {
      init(this, id).delay = value;
    };
  }

  function transition_delay(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? delayFunction
            : delayConstant)(id, value))
        : get$1(this.node(), id).delay;
  }

  function durationFunction(id, value) {
    return function() {
      set$1(this, id).duration = +value.apply(this, arguments);
    };
  }

  function durationConstant(id, value) {
    return value = +value, function() {
      set$1(this, id).duration = value;
    };
  }

  function transition_duration(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? durationFunction
            : durationConstant)(id, value))
        : get$1(this.node(), id).duration;
  }

  function easeConstant(id, value) {
    if (typeof value !== "function") throw new Error;
    return function() {
      set$1(this, id).ease = value;
    };
  }

  function transition_ease(value) {
    var id = this._id;

    return arguments.length
        ? this.each(easeConstant(id, value))
        : get$1(this.node(), id).ease;
  }

  function transition_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Transition(subgroups, this._parents, this._name, this._id);
  }

  function transition_merge(transition$$1) {
    if (transition$$1._id !== this._id) throw new Error;

    for (var groups0 = this._groups, groups1 = transition$$1._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Transition(merges, this._parents, this._name, this._id);
  }

  function start(name) {
    return (name + "").trim().split(/^|\s+/).every(function(t) {
      var i = t.indexOf(".");
      if (i >= 0) t = t.slice(0, i);
      return !t || t === "start";
    });
  }

  function onFunction(id, name, listener) {
    var on0, on1, sit = start(name) ? init : set$1;
    return function() {
      var schedule$$1 = sit(this, id),
          on = schedule$$1.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

      schedule$$1.on = on1;
    };
  }

  function transition_on(name, listener) {
    var id = this._id;

    return arguments.length < 2
        ? get$1(this.node(), id).on.on(name)
        : this.each(onFunction(id, name, listener));
  }

  function removeFunction(id) {
    return function() {
      var parent = this.parentNode;
      for (var i in this.__transition) if (+i !== id) return;
      if (parent) parent.removeChild(this);
    };
  }

  function transition_remove() {
    return this.on("end.remove", removeFunction(this._id));
  }

  function transition_select(select$$1) {
    var name = this._name,
        id = this._id;

    if (typeof select$$1 !== "function") select$$1 = selector(select$$1);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select$$1.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
          schedule(subgroup[i], name, id, i, subgroup, get$1(node, id));
        }
      }
    }

    return new Transition(subgroups, this._parents, name, id);
  }

  function transition_selectAll(select$$1) {
    var name = this._name,
        id = this._id;

    if (typeof select$$1 !== "function") select$$1 = selectorAll(select$$1);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          for (var children = select$$1.call(node, node.__data__, i, group), child, inherit = get$1(node, id), k = 0, l = children.length; k < l; ++k) {
            if (child = children[k]) {
              schedule(child, name, id, k, children, inherit);
            }
          }
          subgroups.push(children);
          parents.push(node);
        }
      }
    }

    return new Transition(subgroups, parents, name, id);
  }

  var Selection$1 = selection.prototype.constructor;

  function transition_selection() {
    return new Selection$1(this._groups, this._parents);
  }

  function styleRemove$1(name, interpolate$$1) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name),
          value1 = (this.style.removeProperty(name), styleValue(this, name));
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value10 = value1);
    };
  }

  function styleRemoveEnd(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant$1(name, interpolate$$1, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value1);
    };
  }

  function styleFunction$1(name, interpolate$$1, value$$1) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name),
          value1 = value$$1(this);
      if (value1 == null) value1 = (this.style.removeProperty(name), styleValue(this, name));
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value10 = value1);
    };
  }

  function transition_style(name, value$$1, priority) {
    var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
    return value$$1 == null ? this
            .styleTween(name, styleRemove$1(name, i))
            .on("end.style." + name, styleRemoveEnd(name))
        : this.styleTween(name, typeof value$$1 === "function"
            ? styleFunction$1(name, i, tweenValue(this, "style." + name, value$$1))
            : styleConstant$1(name, i, value$$1 + ""), priority);
  }

  function styleTween(name, value, priority) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.style.setProperty(name, i(t), priority);
      };
    }
    tween._value = value;
    return tween;
  }

  function transition_styleTween(name, value, priority) {
    var key = "style." + (name += "");
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
  }

  function textConstant$1(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction$1(value) {
    return function() {
      var value1 = value(this);
      this.textContent = value1 == null ? "" : value1;
    };
  }

  function transition_text(value) {
    return this.tween("text", typeof value === "function"
        ? textFunction$1(tweenValue(this, "text", value))
        : textConstant$1(value == null ? "" : value + ""));
  }

  function transition_transition() {
    var name = this._name,
        id0 = this._id,
        id1 = newId();

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          var inherit = get$1(node, id0);
          schedule(node, name, id1, i, group, {
            time: inherit.time + inherit.delay + inherit.duration,
            delay: 0,
            duration: inherit.duration,
            ease: inherit.ease
          });
        }
      }
    }

    return new Transition(groups, this._parents, name, id1);
  }

  var id = 0;

  function Transition(groups, parents, name, id) {
    this._groups = groups;
    this._parents = parents;
    this._name = name;
    this._id = id;
  }

  function transition(name) {
    return selection().transition(name);
  }

  function newId() {
    return ++id;
  }

  var selection_prototype = selection.prototype;

  Transition.prototype = transition.prototype = {
    constructor: Transition,
    select: transition_select,
    selectAll: transition_selectAll,
    filter: transition_filter,
    merge: transition_merge,
    selection: transition_selection,
    transition: transition_transition,
    call: selection_prototype.call,
    nodes: selection_prototype.nodes,
    node: selection_prototype.node,
    size: selection_prototype.size,
    empty: selection_prototype.empty,
    each: selection_prototype.each,
    on: transition_on,
    attr: transition_attr,
    attrTween: transition_attrTween,
    style: transition_style,
    styleTween: transition_styleTween,
    text: transition_text,
    remove: transition_remove,
    tween: transition_tween,
    delay: transition_delay,
    duration: transition_duration,
    ease: transition_ease
  };

  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }

  var pi = Math.PI;

  var tau = 2 * Math.PI;

  var defaultTiming = {
    time: null, // Set on use.
    delay: 0,
    duration: 250,
    ease: cubicInOut
  };

  function inherit(node, id) {
    var timing;
    while (!(timing = node.__transition) || !(timing = timing[id])) {
      if (!(node = node.parentNode)) {
        return defaultTiming.time = now(), defaultTiming;
      }
    }
    return timing;
  }

  function selection_transition(name) {
    var id,
        timing;

    if (name instanceof Transition) {
      id = name._id, name = name._name;
    } else {
      id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
    }

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          schedule(node, name, id, i, group, timing || inherit(node, id));
        }
      }
    }

    return new Transition(groups, this._parents, name, id);
  }

  selection.prototype.interrupt = selection_interrupt;
  selection.prototype.transition = selection_transition;

  // Adds floating point numbers with twice the normal precision.
  // Reference: J. R. Shewchuk, Adaptive Precision Floating-Point Arithmetic and
  // Fast Robust Geometric Predicates, Discrete & Computational Geometry 18(3)
  // 305–363 (1997).
  // Code adapted from GeographicLib by Charles F. F. Karney,
  // http://geographiclib.sourceforge.net/

  function adder() {
    return new Adder;
  }

  function Adder() {
    this.reset();
  }

  Adder.prototype = {
    constructor: Adder,
    reset: function() {
      this.s = // rounded value
      this.t = 0; // exact error
    },
    add: function(y) {
      add(temp, y, this.t);
      add(this, temp.s, this.s);
      if (this.s) this.t += temp.t;
      else this.s = temp.t;
    },
    valueOf: function() {
      return this.s;
    }
  };

  var temp = new Adder;

  function add(adder, a, b) {
    var x = adder.s = a + b,
        bv = x - a,
        av = x - bv;
    adder.t = (a - av) + (b - bv);
  }

  var epsilon = 1e-6;
  var pi$1 = Math.PI;
  var halfPi$1 = pi$1 / 2;
  var quarterPi = pi$1 / 4;
  var tau$1 = pi$1 * 2;

  var degrees$1 = 180 / pi$1;
  var radians = pi$1 / 180;

  var abs = Math.abs;
  var atan = Math.atan;
  var atan2 = Math.atan2;
  var cos = Math.cos;
  var exp = Math.exp;
  var log = Math.log;
  var sin = Math.sin;
  var sqrt = Math.sqrt;
  var tan = Math.tan;

  function acos(x) {
    return x > 1 ? 0 : x < -1 ? pi$1 : Math.acos(x);
  }

  function asin(x) {
    return x > 1 ? halfPi$1 : x < -1 ? -halfPi$1 : Math.asin(x);
  }

  function noop$1() {}

  function streamGeometry(geometry, stream) {
    if (geometry && streamGeometryType.hasOwnProperty(geometry.type)) {
      streamGeometryType[geometry.type](geometry, stream);
    }
  }

  var streamObjectType = {
    Feature: function(object, stream) {
      streamGeometry(object.geometry, stream);
    },
    FeatureCollection: function(object, stream) {
      var features = object.features, i = -1, n = features.length;
      while (++i < n) streamGeometry(features[i].geometry, stream);
    }
  };

  var streamGeometryType = {
    Sphere: function(object, stream) {
      stream.sphere();
    },
    Point: function(object, stream) {
      object = object.coordinates;
      stream.point(object[0], object[1], object[2]);
    },
    MultiPoint: function(object, stream) {
      var coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) object = coordinates[i], stream.point(object[0], object[1], object[2]);
    },
    LineString: function(object, stream) {
      streamLine(object.coordinates, stream, 0);
    },
    MultiLineString: function(object, stream) {
      var coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) streamLine(coordinates[i], stream, 0);
    },
    Polygon: function(object, stream) {
      streamPolygon(object.coordinates, stream);
    },
    MultiPolygon: function(object, stream) {
      var coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) streamPolygon(coordinates[i], stream);
    },
    GeometryCollection: function(object, stream) {
      var geometries = object.geometries, i = -1, n = geometries.length;
      while (++i < n) streamGeometry(geometries[i], stream);
    }
  };

  function streamLine(coordinates, stream, closed) {
    var i = -1, n = coordinates.length - closed, coordinate;
    stream.lineStart();
    while (++i < n) coordinate = coordinates[i], stream.point(coordinate[0], coordinate[1], coordinate[2]);
    stream.lineEnd();
  }

  function streamPolygon(coordinates, stream) {
    var i = -1, n = coordinates.length;
    stream.polygonStart();
    while (++i < n) streamLine(coordinates[i], stream, 1);
    stream.polygonEnd();
  }

  function geoStream(object, stream) {
    if (object && streamObjectType.hasOwnProperty(object.type)) {
      streamObjectType[object.type](object, stream);
    } else {
      streamGeometry(object, stream);
    }
  }

  var areaRingSum = adder();

  var areaSum = adder();

  function spherical(cartesian) {
    return [atan2(cartesian[1], cartesian[0]), asin(cartesian[2])];
  }

  function cartesian(spherical) {
    var lambda = spherical[0], phi = spherical[1], cosPhi = cos(phi);
    return [cosPhi * cos(lambda), cosPhi * sin(lambda), sin(phi)];
  }

  function cartesianDot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function cartesianCross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  // TODO return a
  function cartesianAddInPlace(a, b) {
    a[0] += b[0], a[1] += b[1], a[2] += b[2];
  }

  function cartesianScale(vector, k) {
    return [vector[0] * k, vector[1] * k, vector[2] * k];
  }

  // TODO return d
  function cartesianNormalizeInPlace(d) {
    var l = sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    d[0] /= l, d[1] /= l, d[2] /= l;
  }

  var deltaSum = adder();

  function compose(a, b) {

    function compose(x, y) {
      return x = a(x, y), b(x[0], x[1]);
    }

    if (a.invert && b.invert) compose.invert = function(x, y) {
      return x = b.invert(x, y), x && a.invert(x[0], x[1]);
    };

    return compose;
  }

  function rotationIdentity(lambda, phi) {
    return [lambda > pi$1 ? lambda - tau$1 : lambda < -pi$1 ? lambda + tau$1 : lambda, phi];
  }

  rotationIdentity.invert = rotationIdentity;

  function rotateRadians(deltaLambda, deltaPhi, deltaGamma) {
    return (deltaLambda %= tau$1) ? (deltaPhi || deltaGamma ? compose(rotationLambda(deltaLambda), rotationPhiGamma(deltaPhi, deltaGamma))
      : rotationLambda(deltaLambda))
      : (deltaPhi || deltaGamma ? rotationPhiGamma(deltaPhi, deltaGamma)
      : rotationIdentity);
  }

  function forwardRotationLambda(deltaLambda) {
    return function(lambda, phi) {
      return lambda += deltaLambda, [lambda > pi$1 ? lambda - tau$1 : lambda < -pi$1 ? lambda + tau$1 : lambda, phi];
    };
  }

  function rotationLambda(deltaLambda) {
    var rotation = forwardRotationLambda(deltaLambda);
    rotation.invert = forwardRotationLambda(-deltaLambda);
    return rotation;
  }

  function rotationPhiGamma(deltaPhi, deltaGamma) {
    var cosDeltaPhi = cos(deltaPhi),
        sinDeltaPhi = sin(deltaPhi),
        cosDeltaGamma = cos(deltaGamma),
        sinDeltaGamma = sin(deltaGamma);

    function rotation(lambda, phi) {
      var cosPhi = cos(phi),
          x = cos(lambda) * cosPhi,
          y = sin(lambda) * cosPhi,
          z = sin(phi),
          k = z * cosDeltaPhi + x * sinDeltaPhi;
      return [
        atan2(y * cosDeltaGamma - k * sinDeltaGamma, x * cosDeltaPhi - z * sinDeltaPhi),
        asin(k * cosDeltaGamma + y * sinDeltaGamma)
      ];
    }

    rotation.invert = function(lambda, phi) {
      var cosPhi = cos(phi),
          x = cos(lambda) * cosPhi,
          y = sin(lambda) * cosPhi,
          z = sin(phi),
          k = z * cosDeltaGamma - y * sinDeltaGamma;
      return [
        atan2(y * cosDeltaGamma + z * sinDeltaGamma, x * cosDeltaPhi + k * sinDeltaPhi),
        asin(k * cosDeltaPhi - x * sinDeltaPhi)
      ];
    };

    return rotation;
  }

  function rotation(rotate) {
    rotate = rotateRadians(rotate[0] * radians, rotate[1] * radians, rotate.length > 2 ? rotate[2] * radians : 0);

    function forward(coordinates) {
      coordinates = rotate(coordinates[0] * radians, coordinates[1] * radians);
      return coordinates[0] *= degrees$1, coordinates[1] *= degrees$1, coordinates;
    }

    forward.invert = function(coordinates) {
      coordinates = rotate.invert(coordinates[0] * radians, coordinates[1] * radians);
      return coordinates[0] *= degrees$1, coordinates[1] *= degrees$1, coordinates;
    };

    return forward;
  }

  // Generates a circle centered at [0°, 0°], with a given radius and precision.
  function circleStream(stream, radius, delta, direction, t0, t1) {
    if (!delta) return;
    var cosRadius = cos(radius),
        sinRadius = sin(radius),
        step = direction * delta;
    if (t0 == null) {
      t0 = radius + direction * tau$1;
      t1 = radius - step / 2;
    } else {
      t0 = circleRadius(cosRadius, t0);
      t1 = circleRadius(cosRadius, t1);
      if (direction > 0 ? t0 < t1 : t0 > t1) t0 += direction * tau$1;
    }
    for (var point, t = t0; direction > 0 ? t > t1 : t < t1; t -= step) {
      point = spherical([cosRadius, -sinRadius * cos(t), -sinRadius * sin(t)]);
      stream.point(point[0], point[1]);
    }
  }

  // Returns the signed angle of a cartesian point relative to [cosRadius, 0, 0].
  function circleRadius(cosRadius, point) {
    point = cartesian(point), point[0] -= cosRadius;
    cartesianNormalizeInPlace(point);
    var radius = acos(-point[1]);
    return ((-point[2] < 0 ? -radius : radius) + tau$1 - epsilon) % tau$1;
  }

  function clipBuffer() {
    var lines = [],
        line;
    return {
      point: function(x, y) {
        line.push([x, y]);
      },
      lineStart: function() {
        lines.push(line = []);
      },
      lineEnd: noop$1,
      rejoin: function() {
        if (lines.length > 1) lines.push(lines.pop().concat(lines.shift()));
      },
      result: function() {
        var result = lines;
        lines = [];
        line = null;
        return result;
      }
    };
  }

  function pointEqual(a, b) {
    return abs(a[0] - b[0]) < epsilon && abs(a[1] - b[1]) < epsilon;
  }

  function Intersection(point, points, other, entry) {
    this.x = point;
    this.z = points;
    this.o = other; // another intersection
    this.e = entry; // is an entry?
    this.v = false; // visited
    this.n = this.p = null; // next & previous
  }

  // A generalized polygon clipping algorithm: given a polygon that has been cut
  // into its visible line segments, and rejoins the segments by interpolating
  // along the clip edge.
  function clipRejoin(segments, compareIntersection, startInside, interpolate, stream) {
    var subject = [],
        clip = [],
        i,
        n;

    segments.forEach(function(segment) {
      if ((n = segment.length - 1) <= 0) return;
      var n, p0 = segment[0], p1 = segment[n], x;

      // If the first and last points of a segment are coincident, then treat as a
      // closed ring. TODO if all rings are closed, then the winding order of the
      // exterior ring should be checked.
      if (pointEqual(p0, p1)) {
        stream.lineStart();
        for (i = 0; i < n; ++i) stream.point((p0 = segment[i])[0], p0[1]);
        stream.lineEnd();
        return;
      }

      subject.push(x = new Intersection(p0, segment, null, true));
      clip.push(x.o = new Intersection(p0, null, x, false));
      subject.push(x = new Intersection(p1, segment, null, false));
      clip.push(x.o = new Intersection(p1, null, x, true));
    });

    if (!subject.length) return;

    clip.sort(compareIntersection);
    link(subject);
    link(clip);

    for (i = 0, n = clip.length; i < n; ++i) {
      clip[i].e = startInside = !startInside;
    }

    var start = subject[0],
        points,
        point;

    while (1) {
      // Find first unvisited intersection.
      var current = start,
          isSubject = true;
      while (current.v) if ((current = current.n) === start) return;
      points = current.z;
      stream.lineStart();
      do {
        current.v = current.o.v = true;
        if (current.e) {
          if (isSubject) {
            for (i = 0, n = points.length; i < n; ++i) stream.point((point = points[i])[0], point[1]);
          } else {
            interpolate(current.x, current.n.x, 1, stream);
          }
          current = current.n;
        } else {
          if (isSubject) {
            points = current.p.z;
            for (i = points.length - 1; i >= 0; --i) stream.point((point = points[i])[0], point[1]);
          } else {
            interpolate(current.x, current.p.x, -1, stream);
          }
          current = current.p;
        }
        current = current.o;
        points = current.z;
        isSubject = !isSubject;
      } while (!current.v);
      stream.lineEnd();
    }
  }

  function link(array) {
    if (!(n = array.length)) return;
    var n,
        i = 0,
        a = array[0],
        b;
    while (++i < n) {
      a.n = b = array[i];
      b.p = a;
      a = b;
    }
    a.n = b = array[0];
    b.p = a;
  }

  var sum = adder();

  function polygonContains(polygon, point) {
    var lambda = point[0],
        phi = point[1],
        sinPhi = sin(phi),
        normal = [sin(lambda), -cos(lambda), 0],
        angle = 0,
        winding = 0;

    sum.reset();

    if (sinPhi === 1) phi = halfPi$1 + epsilon;
    else if (sinPhi === -1) phi = -halfPi$1 - epsilon;

    for (var i = 0, n = polygon.length; i < n; ++i) {
      if (!(m = (ring = polygon[i]).length)) continue;
      var ring,
          m,
          point0 = ring[m - 1],
          lambda0 = point0[0],
          phi0 = point0[1] / 2 + quarterPi,
          sinPhi0 = sin(phi0),
          cosPhi0 = cos(phi0);

      for (var j = 0; j < m; ++j, lambda0 = lambda1, sinPhi0 = sinPhi1, cosPhi0 = cosPhi1, point0 = point1) {
        var point1 = ring[j],
            lambda1 = point1[0],
            phi1 = point1[1] / 2 + quarterPi,
            sinPhi1 = sin(phi1),
            cosPhi1 = cos(phi1),
            delta = lambda1 - lambda0,
            sign$$1 = delta >= 0 ? 1 : -1,
            absDelta = sign$$1 * delta,
            antimeridian = absDelta > pi$1,
            k = sinPhi0 * sinPhi1;

        sum.add(atan2(k * sign$$1 * sin(absDelta), cosPhi0 * cosPhi1 + k * cos(absDelta)));
        angle += antimeridian ? delta + sign$$1 * tau$1 : delta;

        // Are the longitudes either side of the point’s meridian (lambda),
        // and are the latitudes smaller than the parallel (phi)?
        if (antimeridian ^ lambda0 >= lambda ^ lambda1 >= lambda) {
          var arc = cartesianCross(cartesian(point0), cartesian(point1));
          cartesianNormalizeInPlace(arc);
          var intersection = cartesianCross(normal, arc);
          cartesianNormalizeInPlace(intersection);
          var phiArc = (antimeridian ^ delta >= 0 ? -1 : 1) * asin(intersection[2]);
          if (phi > phiArc || phi === phiArc && (arc[0] || arc[1])) {
            winding += antimeridian ^ delta >= 0 ? 1 : -1;
          }
        }
      }
    }

    // First, determine whether the South pole is inside or outside:
    //
    // It is inside if:
    // * the polygon winds around it in a clockwise direction.
    // * the polygon does not (cumulatively) wind around it, but has a negative
    //   (counter-clockwise) area.
    //
    // Second, count the (signed) number of times a segment crosses a lambda
    // from the point to the South pole.  If it is zero, then the point is the
    // same side as the South pole.

    return (angle < -epsilon || angle < epsilon && sum < -epsilon) ^ (winding & 1);
  }

  function ascending$1(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function bisector(compare) {
    if (compare.length === 1) compare = ascendingComparator(compare);
    return {
      left: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) < 0) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      right: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) > 0) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      }
    };
  }

  function ascendingComparator(f) {
    return function(d, x) {
      return ascending$1(f(d), x);
    };
  }

  var ascendingBisect = bisector(ascending$1);

  function merge(arrays) {
    var n = arrays.length,
        m,
        i = -1,
        j = 0,
        merged,
        array;

    while (++i < n) j += arrays[i].length;
    merged = new Array(j);

    while (--n >= 0) {
      array = arrays[n];
      m = array.length;
      while (--m >= 0) {
        merged[--j] = array[m];
      }
    }

    return merged;
  }

  function clip(pointVisible, clipLine, interpolate, start) {
    return function(sink) {
      var line = clipLine(sink),
          ringBuffer = clipBuffer(),
          ringSink = clipLine(ringBuffer),
          polygonStarted = false,
          polygon,
          segments,
          ring;

      var clip = {
        point: point,
        lineStart: lineStart,
        lineEnd: lineEnd,
        polygonStart: function() {
          clip.point = pointRing;
          clip.lineStart = ringStart;
          clip.lineEnd = ringEnd;
          segments = [];
          polygon = [];
        },
        polygonEnd: function() {
          clip.point = point;
          clip.lineStart = lineStart;
          clip.lineEnd = lineEnd;
          segments = merge(segments);
          var startInside = polygonContains(polygon, start);
          if (segments.length) {
            if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
            clipRejoin(segments, compareIntersection, startInside, interpolate, sink);
          } else if (startInside) {
            if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
            sink.lineStart();
            interpolate(null, null, 1, sink);
            sink.lineEnd();
          }
          if (polygonStarted) sink.polygonEnd(), polygonStarted = false;
          segments = polygon = null;
        },
        sphere: function() {
          sink.polygonStart();
          sink.lineStart();
          interpolate(null, null, 1, sink);
          sink.lineEnd();
          sink.polygonEnd();
        }
      };

      function point(lambda, phi) {
        if (pointVisible(lambda, phi)) sink.point(lambda, phi);
      }

      function pointLine(lambda, phi) {
        line.point(lambda, phi);
      }

      function lineStart() {
        clip.point = pointLine;
        line.lineStart();
      }

      function lineEnd() {
        clip.point = point;
        line.lineEnd();
      }

      function pointRing(lambda, phi) {
        ring.push([lambda, phi]);
        ringSink.point(lambda, phi);
      }

      function ringStart() {
        ringSink.lineStart();
        ring = [];
      }

      function ringEnd() {
        pointRing(ring[0][0], ring[0][1]);
        ringSink.lineEnd();

        var clean = ringSink.clean(),
            ringSegments = ringBuffer.result(),
            i, n = ringSegments.length, m,
            segment,
            point;

        ring.pop();
        polygon.push(ring);
        ring = null;

        if (!n) return;

        // No intersections.
        if (clean & 1) {
          segment = ringSegments[0];
          if ((m = segment.length - 1) > 0) {
            if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
            sink.lineStart();
            for (i = 0; i < m; ++i) sink.point((point = segment[i])[0], point[1]);
            sink.lineEnd();
          }
          return;
        }

        // Rejoin connected segments.
        // TODO reuse ringBuffer.rejoin()?
        if (n > 1 && clean & 2) ringSegments.push(ringSegments.pop().concat(ringSegments.shift()));

        segments.push(ringSegments.filter(validSegment));
      }

      return clip;
    };
  }

  function validSegment(segment) {
    return segment.length > 1;
  }

  // Intersections are sorted along the clip edge. For both antimeridian cutting
  // and circle clipping, the same comparison is used.
  function compareIntersection(a, b) {
    return ((a = a.x)[0] < 0 ? a[1] - halfPi$1 - epsilon : halfPi$1 - a[1])
         - ((b = b.x)[0] < 0 ? b[1] - halfPi$1 - epsilon : halfPi$1 - b[1]);
  }

  var clipAntimeridian = clip(
    function() { return true; },
    clipAntimeridianLine,
    clipAntimeridianInterpolate,
    [-pi$1, -halfPi$1]
  );

  // Takes a line and cuts into visible segments. Return values: 0 - there were
  // intersections or the line was empty; 1 - no intersections; 2 - there were
  // intersections, and the first and last segments should be rejoined.
  function clipAntimeridianLine(stream) {
    var lambda0 = NaN,
        phi0 = NaN,
        sign0 = NaN,
        clean; // no intersections

    return {
      lineStart: function() {
        stream.lineStart();
        clean = 1;
      },
      point: function(lambda1, phi1) {
        var sign1 = lambda1 > 0 ? pi$1 : -pi$1,
            delta = abs(lambda1 - lambda0);
        if (abs(delta - pi$1) < epsilon) { // line crosses a pole
          stream.point(lambda0, phi0 = (phi0 + phi1) / 2 > 0 ? halfPi$1 : -halfPi$1);
          stream.point(sign0, phi0);
          stream.lineEnd();
          stream.lineStart();
          stream.point(sign1, phi0);
          stream.point(lambda1, phi0);
          clean = 0;
        } else if (sign0 !== sign1 && delta >= pi$1) { // line crosses antimeridian
          if (abs(lambda0 - sign0) < epsilon) lambda0 -= sign0 * epsilon; // handle degeneracies
          if (abs(lambda1 - sign1) < epsilon) lambda1 -= sign1 * epsilon;
          phi0 = clipAntimeridianIntersect(lambda0, phi0, lambda1, phi1);
          stream.point(sign0, phi0);
          stream.lineEnd();
          stream.lineStart();
          stream.point(sign1, phi0);
          clean = 0;
        }
        stream.point(lambda0 = lambda1, phi0 = phi1);
        sign0 = sign1;
      },
      lineEnd: function() {
        stream.lineEnd();
        lambda0 = phi0 = NaN;
      },
      clean: function() {
        return 2 - clean; // if intersections, rejoin first and last segments
      }
    };
  }

  function clipAntimeridianIntersect(lambda0, phi0, lambda1, phi1) {
    var cosPhi0,
        cosPhi1,
        sinLambda0Lambda1 = sin(lambda0 - lambda1);
    return abs(sinLambda0Lambda1) > epsilon
        ? atan((sin(phi0) * (cosPhi1 = cos(phi1)) * sin(lambda1)
            - sin(phi1) * (cosPhi0 = cos(phi0)) * sin(lambda0))
            / (cosPhi0 * cosPhi1 * sinLambda0Lambda1))
        : (phi0 + phi1) / 2;
  }

  function clipAntimeridianInterpolate(from, to, direction, stream) {
    var phi;
    if (from == null) {
      phi = direction * halfPi$1;
      stream.point(-pi$1, phi);
      stream.point(0, phi);
      stream.point(pi$1, phi);
      stream.point(pi$1, 0);
      stream.point(pi$1, -phi);
      stream.point(0, -phi);
      stream.point(-pi$1, -phi);
      stream.point(-pi$1, 0);
      stream.point(-pi$1, phi);
    } else if (abs(from[0] - to[0]) > epsilon) {
      var lambda = from[0] < to[0] ? pi$1 : -pi$1;
      phi = direction * lambda / 2;
      stream.point(-lambda, phi);
      stream.point(0, phi);
      stream.point(lambda, phi);
    } else {
      stream.point(to[0], to[1]);
    }
  }

  function clipCircle(radius) {
    var cr = cos(radius),
        delta = 6 * radians,
        smallRadius = cr > 0,
        notHemisphere = abs(cr) > epsilon; // TODO optimise for this common case

    function interpolate(from, to, direction, stream) {
      circleStream(stream, radius, delta, direction, from, to);
    }

    function visible(lambda, phi) {
      return cos(lambda) * cos(phi) > cr;
    }

    // Takes a line and cuts into visible segments. Return values used for polygon
    // clipping: 0 - there were intersections or the line was empty; 1 - no
    // intersections 2 - there were intersections, and the first and last segments
    // should be rejoined.
    function clipLine(stream) {
      var point0, // previous point
          c0, // code for previous point
          v0, // visibility of previous point
          v00, // visibility of first point
          clean; // no intersections
      return {
        lineStart: function() {
          v00 = v0 = false;
          clean = 1;
        },
        point: function(lambda, phi) {
          var point1 = [lambda, phi],
              point2,
              v = visible(lambda, phi),
              c = smallRadius
                ? v ? 0 : code(lambda, phi)
                : v ? code(lambda + (lambda < 0 ? pi$1 : -pi$1), phi) : 0;
          if (!point0 && (v00 = v0 = v)) stream.lineStart();
          // Handle degeneracies.
          // TODO ignore if not clipping polygons.
          if (v !== v0) {
            point2 = intersect(point0, point1);
            if (!point2 || pointEqual(point0, point2) || pointEqual(point1, point2)) {
              point1[0] += epsilon;
              point1[1] += epsilon;
              v = visible(point1[0], point1[1]);
            }
          }
          if (v !== v0) {
            clean = 0;
            if (v) {
              // outside going in
              stream.lineStart();
              point2 = intersect(point1, point0);
              stream.point(point2[0], point2[1]);
            } else {
              // inside going out
              point2 = intersect(point0, point1);
              stream.point(point2[0], point2[1]);
              stream.lineEnd();
            }
            point0 = point2;
          } else if (notHemisphere && point0 && smallRadius ^ v) {
            var t;
            // If the codes for two points are different, or are both zero,
            // and there this segment intersects with the small circle.
            if (!(c & c0) && (t = intersect(point1, point0, true))) {
              clean = 0;
              if (smallRadius) {
                stream.lineStart();
                stream.point(t[0][0], t[0][1]);
                stream.point(t[1][0], t[1][1]);
                stream.lineEnd();
              } else {
                stream.point(t[1][0], t[1][1]);
                stream.lineEnd();
                stream.lineStart();
                stream.point(t[0][0], t[0][1]);
              }
            }
          }
          if (v && (!point0 || !pointEqual(point0, point1))) {
            stream.point(point1[0], point1[1]);
          }
          point0 = point1, v0 = v, c0 = c;
        },
        lineEnd: function() {
          if (v0) stream.lineEnd();
          point0 = null;
        },
        // Rejoin first and last segments if there were intersections and the first
        // and last points were visible.
        clean: function() {
          return clean | ((v00 && v0) << 1);
        }
      };
    }

    // Intersects the great circle between a and b with the clip circle.
    function intersect(a, b, two) {
      var pa = cartesian(a),
          pb = cartesian(b);

      // We have two planes, n1.p = d1 and n2.p = d2.
      // Find intersection line p(t) = c1 n1 + c2 n2 + t (n1 ⨯ n2).
      var n1 = [1, 0, 0], // normal
          n2 = cartesianCross(pa, pb),
          n2n2 = cartesianDot(n2, n2),
          n1n2 = n2[0], // cartesianDot(n1, n2),
          determinant = n2n2 - n1n2 * n1n2;

      // Two polar points.
      if (!determinant) return !two && a;

      var c1 =  cr * n2n2 / determinant,
          c2 = -cr * n1n2 / determinant,
          n1xn2 = cartesianCross(n1, n2),
          A = cartesianScale(n1, c1),
          B = cartesianScale(n2, c2);
      cartesianAddInPlace(A, B);

      // Solve |p(t)|^2 = 1.
      var u = n1xn2,
          w = cartesianDot(A, u),
          uu = cartesianDot(u, u),
          t2 = w * w - uu * (cartesianDot(A, A) - 1);

      if (t2 < 0) return;

      var t = sqrt(t2),
          q = cartesianScale(u, (-w - t) / uu);
      cartesianAddInPlace(q, A);
      q = spherical(q);

      if (!two) return q;

      // Two intersection points.
      var lambda0 = a[0],
          lambda1 = b[0],
          phi0 = a[1],
          phi1 = b[1],
          z;

      if (lambda1 < lambda0) z = lambda0, lambda0 = lambda1, lambda1 = z;

      var delta = lambda1 - lambda0,
          polar = abs(delta - pi$1) < epsilon,
          meridian = polar || delta < epsilon;

      if (!polar && phi1 < phi0) z = phi0, phi0 = phi1, phi1 = z;

      // Check that the first point is between a and b.
      if (meridian
          ? polar
            ? phi0 + phi1 > 0 ^ q[1] < (abs(q[0] - lambda0) < epsilon ? phi0 : phi1)
            : phi0 <= q[1] && q[1] <= phi1
          : delta > pi$1 ^ (lambda0 <= q[0] && q[0] <= lambda1)) {
        var q1 = cartesianScale(u, (-w + t) / uu);
        cartesianAddInPlace(q1, A);
        return [q, spherical(q1)];
      }
    }

    // Generates a 4-bit vector representing the location of a point relative to
    // the small circle's bounding box.
    function code(lambda, phi) {
      var r = smallRadius ? radius : pi$1 - radius,
          code = 0;
      if (lambda < -r) code |= 1; // left
      else if (lambda > r) code |= 2; // right
      if (phi < -r) code |= 4; // below
      else if (phi > r) code |= 8; // above
      return code;
    }

    return clip(visible, clipLine, interpolate, smallRadius ? [0, -radius] : [-pi$1, radius - pi$1]);
  }

  function clipLine(a, b, x0, y0, x1, y1) {
    var ax = a[0],
        ay = a[1],
        bx = b[0],
        by = b[1],
        t0 = 0,
        t1 = 1,
        dx = bx - ax,
        dy = by - ay,
        r;

    r = x0 - ax;
    if (!dx && r > 0) return;
    r /= dx;
    if (dx < 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    } else if (dx > 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    }

    r = x1 - ax;
    if (!dx && r < 0) return;
    r /= dx;
    if (dx < 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    } else if (dx > 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    }

    r = y0 - ay;
    if (!dy && r > 0) return;
    r /= dy;
    if (dy < 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    } else if (dy > 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    }

    r = y1 - ay;
    if (!dy && r < 0) return;
    r /= dy;
    if (dy < 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    } else if (dy > 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    }

    if (t0 > 0) a[0] = ax + t0 * dx, a[1] = ay + t0 * dy;
    if (t1 < 1) b[0] = ax + t1 * dx, b[1] = ay + t1 * dy;
    return true;
  }

  var clipMax = 1e9, clipMin = -clipMax;

  // TODO Use d3-polygon’s polygonContains here for the ring check?
  // TODO Eliminate duplicate buffering in clipBuffer and polygon.push?

  function clipRectangle(x0, y0, x1, y1) {

    function visible(x, y) {
      return x0 <= x && x <= x1 && y0 <= y && y <= y1;
    }

    function interpolate(from, to, direction, stream) {
      var a = 0, a1 = 0;
      if (from == null
          || (a = corner(from, direction)) !== (a1 = corner(to, direction))
          || comparePoint(from, to) < 0 ^ direction > 0) {
        do stream.point(a === 0 || a === 3 ? x0 : x1, a > 1 ? y1 : y0);
        while ((a = (a + direction + 4) % 4) !== a1);
      } else {
        stream.point(to[0], to[1]);
      }
    }

    function corner(p, direction) {
      return abs(p[0] - x0) < epsilon ? direction > 0 ? 0 : 3
          : abs(p[0] - x1) < epsilon ? direction > 0 ? 2 : 1
          : abs(p[1] - y0) < epsilon ? direction > 0 ? 1 : 0
          : direction > 0 ? 3 : 2; // abs(p[1] - y1) < epsilon
    }

    function compareIntersection(a, b) {
      return comparePoint(a.x, b.x);
    }

    function comparePoint(a, b) {
      var ca = corner(a, 1),
          cb = corner(b, 1);
      return ca !== cb ? ca - cb
          : ca === 0 ? b[1] - a[1]
          : ca === 1 ? a[0] - b[0]
          : ca === 2 ? a[1] - b[1]
          : b[0] - a[0];
    }

    return function(stream) {
      var activeStream = stream,
          bufferStream = clipBuffer(),
          segments,
          polygon,
          ring,
          x__, y__, v__, // first point
          x_, y_, v_, // previous point
          first,
          clean;

      var clipStream = {
        point: point,
        lineStart: lineStart,
        lineEnd: lineEnd,
        polygonStart: polygonStart,
        polygonEnd: polygonEnd
      };

      function point(x, y) {
        if (visible(x, y)) activeStream.point(x, y);
      }

      function polygonInside() {
        var winding = 0;

        for (var i = 0, n = polygon.length; i < n; ++i) {
          for (var ring = polygon[i], j = 1, m = ring.length, point = ring[0], a0, a1, b0 = point[0], b1 = point[1]; j < m; ++j) {
            a0 = b0, a1 = b1, point = ring[j], b0 = point[0], b1 = point[1];
            if (a1 <= y1) { if (b1 > y1 && (b0 - a0) * (y1 - a1) > (b1 - a1) * (x0 - a0)) ++winding; }
            else { if (b1 <= y1 && (b0 - a0) * (y1 - a1) < (b1 - a1) * (x0 - a0)) --winding; }
          }
        }

        return winding;
      }

      // Buffer geometry within a polygon and then clip it en masse.
      function polygonStart() {
        activeStream = bufferStream, segments = [], polygon = [], clean = true;
      }

      function polygonEnd() {
        var startInside = polygonInside(),
            cleanInside = clean && startInside,
            visible = (segments = merge(segments)).length;
        if (cleanInside || visible) {
          stream.polygonStart();
          if (cleanInside) {
            stream.lineStart();
            interpolate(null, null, 1, stream);
            stream.lineEnd();
          }
          if (visible) {
            clipRejoin(segments, compareIntersection, startInside, interpolate, stream);
          }
          stream.polygonEnd();
        }
        activeStream = stream, segments = polygon = ring = null;
      }

      function lineStart() {
        clipStream.point = linePoint;
        if (polygon) polygon.push(ring = []);
        first = true;
        v_ = false;
        x_ = y_ = NaN;
      }

      // TODO rather than special-case polygons, simply handle them separately.
      // Ideally, coincident intersection points should be jittered to avoid
      // clipping issues.
      function lineEnd() {
        if (segments) {
          linePoint(x__, y__);
          if (v__ && v_) bufferStream.rejoin();
          segments.push(bufferStream.result());
        }
        clipStream.point = point;
        if (v_) activeStream.lineEnd();
      }

      function linePoint(x, y) {
        var v = visible(x, y);
        if (polygon) ring.push([x, y]);
        if (first) {
          x__ = x, y__ = y, v__ = v;
          first = false;
          if (v) {
            activeStream.lineStart();
            activeStream.point(x, y);
          }
        } else {
          if (v && v_) activeStream.point(x, y);
          else {
            var a = [x_ = Math.max(clipMin, Math.min(clipMax, x_)), y_ = Math.max(clipMin, Math.min(clipMax, y_))],
                b = [x = Math.max(clipMin, Math.min(clipMax, x)), y = Math.max(clipMin, Math.min(clipMax, y))];
            if (clipLine(a, b, x0, y0, x1, y1)) {
              if (!v_) {
                activeStream.lineStart();
                activeStream.point(a[0], a[1]);
              }
              activeStream.point(b[0], b[1]);
              if (!v) activeStream.lineEnd();
              clean = false;
            } else if (v) {
              activeStream.lineStart();
              activeStream.point(x, y);
              clean = false;
            }
          }
        }
        x_ = x, y_ = y, v_ = v;
      }

      return clipStream;
    };
  }

  var lengthSum = adder();

  function identity$2(x) {
    return x;
  }

  var areaSum$1 = adder(),
      areaRingSum$1 = adder();

  var x0$2 = Infinity,
      y0$2 = x0$2,
      x1 = -x0$2,
      y1 = x1;

  var boundsStream$1 = {
    point: boundsPoint$1,
    lineStart: noop$1,
    lineEnd: noop$1,
    polygonStart: noop$1,
    polygonEnd: noop$1,
    result: function() {
      var bounds = [[x0$2, y0$2], [x1, y1]];
      x1 = y1 = -(y0$2 = x0$2 = Infinity);
      return bounds;
    }
  };

  function boundsPoint$1(x, y) {
    if (x < x0$2) x0$2 = x;
    if (x > x1) x1 = x;
    if (y < y0$2) y0$2 = y;
    if (y > y1) y1 = y;
  }

  var lengthSum$1 = adder();

  function transformer(methods) {
    return function(stream) {
      var s = new TransformStream;
      for (var key in methods) s[key] = methods[key];
      s.stream = stream;
      return s;
    };
  }

  function TransformStream() {}

  TransformStream.prototype = {
    constructor: TransformStream,
    point: function(x, y) { this.stream.point(x, y); },
    sphere: function() { this.stream.sphere(); },
    lineStart: function() { this.stream.lineStart(); },
    lineEnd: function() { this.stream.lineEnd(); },
    polygonStart: function() { this.stream.polygonStart(); },
    polygonEnd: function() { this.stream.polygonEnd(); }
  };

  function fit(projection, fitBounds, object) {
    var clip = projection.clipExtent && projection.clipExtent();
    projection.scale(150).translate([0, 0]);
    if (clip != null) projection.clipExtent(null);
    geoStream(object, projection.stream(boundsStream$1));
    fitBounds(boundsStream$1.result());
    if (clip != null) projection.clipExtent(clip);
    return projection;
  }

  function fitExtent(projection, extent, object) {
    return fit(projection, function(b) {
      var w = extent[1][0] - extent[0][0],
          h = extent[1][1] - extent[0][1],
          k = Math.min(w / (b[1][0] - b[0][0]), h / (b[1][1] - b[0][1])),
          x = +extent[0][0] + (w - k * (b[1][0] + b[0][0])) / 2,
          y = +extent[0][1] + (h - k * (b[1][1] + b[0][1])) / 2;
      projection.scale(150 * k).translate([x, y]);
    }, object);
  }

  function fitSize(projection, size, object) {
    return fitExtent(projection, [[0, 0], size], object);
  }

  function fitWidth(projection, width, object) {
    return fit(projection, function(b) {
      var w = +width,
          k = w / (b[1][0] - b[0][0]),
          x = (w - k * (b[1][0] + b[0][0])) / 2,
          y = -k * b[0][1];
      projection.scale(150 * k).translate([x, y]);
    }, object);
  }

  function fitHeight(projection, height, object) {
    return fit(projection, function(b) {
      var h = +height,
          k = h / (b[1][1] - b[0][1]),
          x = -k * b[0][0],
          y = (h - k * (b[1][1] + b[0][1])) / 2;
      projection.scale(150 * k).translate([x, y]);
    }, object);
  }

  var maxDepth = 16, // maximum depth of subdivision
      cosMinDistance = cos(30 * radians); // cos(minimum angular distance)

  function resample(project, delta2) {
    return +delta2 ? resample$1(project, delta2) : resampleNone(project);
  }

  function resampleNone(project) {
    return transformer({
      point: function(x, y) {
        x = project(x, y);
        this.stream.point(x[0], x[1]);
      }
    });
  }

  function resample$1(project, delta2) {

    function resampleLineTo(x0, y0, lambda0, a0, b0, c0, x1, y1, lambda1, a1, b1, c1, depth, stream) {
      var dx = x1 - x0,
          dy = y1 - y0,
          d2 = dx * dx + dy * dy;
      if (d2 > 4 * delta2 && depth--) {
        var a = a0 + a1,
            b = b0 + b1,
            c = c0 + c1,
            m = sqrt(a * a + b * b + c * c),
            phi2 = asin(c /= m),
            lambda2 = abs(abs(c) - 1) < epsilon || abs(lambda0 - lambda1) < epsilon ? (lambda0 + lambda1) / 2 : atan2(b, a),
            p = project(lambda2, phi2),
            x2 = p[0],
            y2 = p[1],
            dx2 = x2 - x0,
            dy2 = y2 - y0,
            dz = dy * dx2 - dx * dy2;
        if (dz * dz / d2 > delta2 // perpendicular projected distance
            || abs((dx * dx2 + dy * dy2) / d2 - 0.5) > 0.3 // midpoint close to an end
            || a0 * a1 + b0 * b1 + c0 * c1 < cosMinDistance) { // angular distance
          resampleLineTo(x0, y0, lambda0, a0, b0, c0, x2, y2, lambda2, a /= m, b /= m, c, depth, stream);
          stream.point(x2, y2);
          resampleLineTo(x2, y2, lambda2, a, b, c, x1, y1, lambda1, a1, b1, c1, depth, stream);
        }
      }
    }
    return function(stream) {
      var lambda00, x00, y00, a00, b00, c00, // first point
          lambda0, x0, y0, a0, b0, c0; // previous point

      var resampleStream = {
        point: point,
        lineStart: lineStart,
        lineEnd: lineEnd,
        polygonStart: function() { stream.polygonStart(); resampleStream.lineStart = ringStart; },
        polygonEnd: function() { stream.polygonEnd(); resampleStream.lineStart = lineStart; }
      };

      function point(x, y) {
        x = project(x, y);
        stream.point(x[0], x[1]);
      }

      function lineStart() {
        x0 = NaN;
        resampleStream.point = linePoint;
        stream.lineStart();
      }

      function linePoint(lambda, phi) {
        var c = cartesian([lambda, phi]), p = project(lambda, phi);
        resampleLineTo(x0, y0, lambda0, a0, b0, c0, x0 = p[0], y0 = p[1], lambda0 = lambda, a0 = c[0], b0 = c[1], c0 = c[2], maxDepth, stream);
        stream.point(x0, y0);
      }

      function lineEnd() {
        resampleStream.point = point;
        stream.lineEnd();
      }

      function ringStart() {
        lineStart();
        resampleStream.point = ringPoint;
        resampleStream.lineEnd = ringEnd;
      }

      function ringPoint(lambda, phi) {
        linePoint(lambda00 = lambda, phi), x00 = x0, y00 = y0, a00 = a0, b00 = b0, c00 = c0;
        resampleStream.point = linePoint;
      }

      function ringEnd() {
        resampleLineTo(x0, y0, lambda0, a0, b0, c0, x00, y00, lambda00, a00, b00, c00, maxDepth, stream);
        resampleStream.lineEnd = lineEnd;
        lineEnd();
      }

      return resampleStream;
    };
  }

  var transformRadians = transformer({
    point: function(x, y) {
      this.stream.point(x * radians, y * radians);
    }
  });

  function transformRotate(rotate) {
    return transformer({
      point: function(x, y) {
        var r = rotate(x, y);
        return this.stream.point(r[0], r[1]);
      }
    });
  }

  function scaleTranslate(k, dx, dy) {
    function transform$$1(x, y) {
      return [dx + k * x, dy - k * y];
    }
    transform$$1.invert = function(x, y) {
      return [(x - dx) / k, (dy - y) / k];
    };
    return transform$$1;
  }

  function scaleTranslateRotate(k, dx, dy, alpha) {
    var cosAlpha = cos(alpha),
        sinAlpha = sin(alpha),
        a = cosAlpha * k,
        b = sinAlpha * k,
        ai = cosAlpha / k,
        bi = sinAlpha / k,
        ci = (sinAlpha * dy - cosAlpha * dx) / k,
        fi = (sinAlpha * dx + cosAlpha * dy) / k;
    function transform$$1(x, y) {
      return [a * x - b * y + dx, dy - b * x - a * y];
    }
    transform$$1.invert = function(x, y) {
      return [ai * x - bi * y + ci, fi - bi * x - ai * y];
    };
    return transform$$1;
  }

  function projection(project) {
    return projectionMutator(function() { return project; })();
  }

  function projectionMutator(projectAt) {
    var project,
        k = 150, // scale
        x = 480, y = 250, // translate
        lambda = 0, phi = 0, // center
        deltaLambda = 0, deltaPhi = 0, deltaGamma = 0, rotate, // pre-rotate
        alpha = 0, // post-rotate
        theta = null, preclip = clipAntimeridian, // pre-clip angle
        x0 = null, y0, x1, y1, postclip = identity$2, // post-clip extent
        delta2 = 0.5, // precision
        projectResample,
        projectTransform,
        projectRotateTransform,
        cache,
        cacheStream;

    function projection(point) {
      return projectRotateTransform(point[0] * radians, point[1] * radians);
    }

    function invert(point) {
      point = projectRotateTransform.invert(point[0], point[1]);
      return point && [point[0] * degrees$1, point[1] * degrees$1];
    }

    projection.stream = function(stream) {
      return cache && cacheStream === stream ? cache : cache = transformRadians(transformRotate(rotate)(preclip(projectResample(postclip(cacheStream = stream)))));
    };

    projection.preclip = function(_) {
      return arguments.length ? (preclip = _, theta = undefined, reset()) : preclip;
    };

    projection.postclip = function(_) {
      return arguments.length ? (postclip = _, x0 = y0 = x1 = y1 = null, reset()) : postclip;
    };

    projection.clipAngle = function(_) {
      return arguments.length ? (preclip = +_ ? clipCircle(theta = _ * radians) : (theta = null, clipAntimeridian), reset()) : theta * degrees$1;
    };

    projection.clipExtent = function(_) {
      return arguments.length ? (postclip = _ == null ? (x0 = y0 = x1 = y1 = null, identity$2) : clipRectangle(x0 = +_[0][0], y0 = +_[0][1], x1 = +_[1][0], y1 = +_[1][1]), reset()) : x0 == null ? null : [[x0, y0], [x1, y1]];
    };

    projection.scale = function(_) {
      return arguments.length ? (k = +_, recenter()) : k;
    };

    projection.translate = function(_) {
      return arguments.length ? (x = +_[0], y = +_[1], recenter()) : [x, y];
    };

    projection.center = function(_) {
      return arguments.length ? (lambda = _[0] % 360 * radians, phi = _[1] % 360 * radians, recenter()) : [lambda * degrees$1, phi * degrees$1];
    };

    projection.rotate = function(_) {
      return arguments.length ? (deltaLambda = _[0] % 360 * radians, deltaPhi = _[1] % 360 * radians, deltaGamma = _.length > 2 ? _[2] % 360 * radians : 0, recenter()) : [deltaLambda * degrees$1, deltaPhi * degrees$1, deltaGamma * degrees$1];
    };

    projection.angle = function(_) {
      return arguments.length ? (alpha = _ % 360 * radians, recenter()) : alpha * degrees$1;
    };

    projection.precision = function(_) {
      return arguments.length ? (projectResample = resample(projectTransform, delta2 = _ * _), reset()) : sqrt(delta2);
    };

    projection.fitExtent = function(extent, object) {
      return fitExtent(projection, extent, object);
    };

    projection.fitSize = function(size, object) {
      return fitSize(projection, size, object);
    };

    projection.fitWidth = function(width, object) {
      return fitWidth(projection, width, object);
    };

    projection.fitHeight = function(height, object) {
      return fitHeight(projection, height, object);
    };

    function recenter() {
      var center = scaleTranslateRotate(k, 0, 0, alpha).apply(null, project(lambda, phi)),
          transform$$1 = (alpha ? scaleTranslateRotate : scaleTranslate)(k, x - center[0], y - center[1], alpha);
      rotate = rotateRadians(deltaLambda, deltaPhi, deltaGamma);
      projectTransform = compose(project, transform$$1);
      projectRotateTransform = compose(rotate, projectTransform);
      projectResample = resample(projectTransform, delta2);
      return reset();
    }

    function reset() {
      cache = cacheStream = null;
      return projection;
    }

    return function() {
      project = projectAt.apply(this, arguments);
      projection.invert = project.invert && invert;
      return recenter();
    };
  }

  function mercatorRaw(lambda, phi) {
    return [lambda, log(tan((halfPi$1 + phi) / 2))];
  }

  mercatorRaw.invert = function(x, y) {
    return [x, 2 * atan(exp(y)) - halfPi$1];
  };

  function geoMercator() {
    return mercatorProjection(mercatorRaw)
        .scale(961 / tau$1);
  }

  function mercatorProjection(project) {
    var m = projection(project),
        center = m.center,
        scale = m.scale,
        translate = m.translate,
        clipExtent = m.clipExtent,
        x0 = null, y0, x1, y1; // clip extent

    m.scale = function(_) {
      return arguments.length ? (scale(_), reclip()) : scale();
    };

    m.translate = function(_) {
      return arguments.length ? (translate(_), reclip()) : translate();
    };

    m.center = function(_) {
      return arguments.length ? (center(_), reclip()) : center();
    };

    m.clipExtent = function(_) {
      return arguments.length ? ((_ == null ? x0 = y0 = x1 = y1 = null : (x0 = +_[0][0], y0 = +_[0][1], x1 = +_[1][0], y1 = +_[1][1])), reclip()) : x0 == null ? null : [[x0, y0], [x1, y1]];
    };

    function reclip() {
      var k = pi$1 * scale(),
          t = m(rotation(m.rotate()).invert([0, 0]));
      return clipExtent(x0 == null
          ? [[t[0] - k, t[1] - k], [t[0] + k, t[1] + k]] : project === mercatorRaw
          ? [[Math.max(t[0] - k, x0), y0], [Math.min(t[0] + k, x1), y1]]
          : [[x0, Math.max(t[1] - k, y0)], [x1, Math.min(t[1] + k, y1)]]);
    }

    return reclip();
  }

  var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function unwrapExports (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var topogram = createCommonjsModule(function (module, exports) {
  (function (global, factory) {
  	factory(exports);
  }(commonjsGlobal, function (exports) {
  	function ascending(a, b) {
  	  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  	}

  	function bisector(compare) {
  	  if (compare.length === 1) compare = ascendingComparator(compare);
  	  return {
  	    left: function(a, x, lo, hi) {
  	      if (lo == null) lo = 0;
  	      if (hi == null) hi = a.length;
  	      while (lo < hi) {
  	        var mid = lo + hi >>> 1;
  	        if (compare(a[mid], x) < 0) lo = mid + 1;
  	        else hi = mid;
  	      }
  	      return lo;
  	    },
  	    right: function(a, x, lo, hi) {
  	      if (lo == null) lo = 0;
  	      if (hi == null) hi = a.length;
  	      while (lo < hi) {
  	        var mid = lo + hi >>> 1;
  	        if (compare(a[mid], x) > 0) hi = mid;
  	        else lo = mid + 1;
  	      }
  	      return lo;
  	    }
  	  };
  	}

  	function ascendingComparator(f) {
  	  return function(d, x) {
  	    return ascending(f(d), x);
  	  };
  	}

  	var ascendingBisect = bisector(ascending);

  	function merge(arrays) {
  	  var n = arrays.length,
  	      m,
  	      i = -1,
  	      j = 0,
  	      merged,
  	      array;

  	  while (++i < n) j += arrays[i].length;
  	  merged = new Array(j);

  	  while (--n >= 0) {
  	    array = arrays[n];
  	    m = array.length;
  	    while (--m >= 0) {
  	      merged[--j] = array[m];
  	    }
  	  }

  	  return merged;
  	}

  	function sum(array, f) {
  	  var s = 0,
  	      n = array.length,
  	      a,
  	      i = -1;

  	  if (f == null) {
  	    while (++i < n) if (a = +array[i]) s += a; // Note: zero and null are equivalent.
  	  }

  	  else {
  	    while (++i < n) if (a = +f(array[i], i, array)) s += a;
  	  }

  	  return s;
  	}

  	// Adds floating point numbers with twice the normal precision.
  	// Reference: J. R. Shewchuk, Adaptive Precision Floating-Point Arithmetic and
  	// Fast Robust Geometric Predicates, Discrete & Computational Geometry 18(3)
  	// 305–363 (1997).
  	// Code adapted from GeographicLib by Charles F. F. Karney,
  	// http://geographiclib.sourceforge.net/

  	function adder() {
  	  return new Adder;
  	}

  	function Adder() {
  	  this.reset();
  	}

  	Adder.prototype = {
  	  constructor: Adder,
  	  reset: function() {
  	    this.s = // rounded value
  	    this.t = 0; // exact error
  	  },
  	  add: function(y) {
  	    add(temp, y, this.t);
  	    add(this, temp.s, this.s);
  	    if (this.s) this.t += temp.t;
  	    else this.s = temp.t;
  	  },
  	  valueOf: function() {
  	    return this.s;
  	  }
  	};

  	var temp = new Adder;

  	function add(adder, a, b) {
  	  var x = adder.s = a + b,
  	      bv = x - a,
  	      av = x - bv;
  	  adder.t = (a - av) + (b - bv);
  	}

  	var epsilon = 1e-6;
  	var pi = Math.PI;
  	var halfPi = pi / 2;
  	var quarterPi = pi / 4;
  	var tau = pi * 2;

  	var degrees = 180 / pi;
  	var radians = pi / 180;

  	var abs = Math.abs;
  	var atan = Math.atan;
  	var atan2 = Math.atan2;
  	var cos = Math.cos;
  	var sin = Math.sin;
  	var sign = Math.sign || function(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; };
  	var sqrt = Math.sqrt;
  	function acos(x) {
  	  return x > 1 ? 0 : x < -1 ? pi : Math.acos(x);
  	}

  	function asin(x) {
  	  return x > 1 ? halfPi : x < -1 ? -halfPi : Math.asin(x);
  	}

  	function noop() {}

  	function streamGeometry(geometry, stream) {
  	  if (geometry && streamGeometryType.hasOwnProperty(geometry.type)) {
  	    streamGeometryType[geometry.type](geometry, stream);
  	  }
  	}

  	var streamObjectType = {
  	  Feature: function(object, stream) {
  	    streamGeometry(object.geometry, stream);
  	  },
  	  FeatureCollection: function(object, stream) {
  	    var features = object.features, i = -1, n = features.length;
  	    while (++i < n) streamGeometry(features[i].geometry, stream);
  	  }
  	};

  	var streamGeometryType = {
  	  Sphere: function(object, stream) {
  	    stream.sphere();
  	  },
  	  Point: function(object, stream) {
  	    object = object.coordinates;
  	    stream.point(object[0], object[1], object[2]);
  	  },
  	  MultiPoint: function(object, stream) {
  	    var coordinates = object.coordinates, i = -1, n = coordinates.length;
  	    while (++i < n) object = coordinates[i], stream.point(object[0], object[1], object[2]);
  	  },
  	  LineString: function(object, stream) {
  	    streamLine(object.coordinates, stream, 0);
  	  },
  	  MultiLineString: function(object, stream) {
  	    var coordinates = object.coordinates, i = -1, n = coordinates.length;
  	    while (++i < n) streamLine(coordinates[i], stream, 0);
  	  },
  	  Polygon: function(object, stream) {
  	    streamPolygon(object.coordinates, stream);
  	  },
  	  MultiPolygon: function(object, stream) {
  	    var coordinates = object.coordinates, i = -1, n = coordinates.length;
  	    while (++i < n) streamPolygon(coordinates[i], stream);
  	  },
  	  GeometryCollection: function(object, stream) {
  	    var geometries = object.geometries, i = -1, n = geometries.length;
  	    while (++i < n) streamGeometry(geometries[i], stream);
  	  }
  	};

  	function streamLine(coordinates, stream, closed) {
  	  var i = -1, n = coordinates.length - closed, coordinate;
  	  stream.lineStart();
  	  while (++i < n) coordinate = coordinates[i], stream.point(coordinate[0], coordinate[1], coordinate[2]);
  	  stream.lineEnd();
  	}

  	function streamPolygon(coordinates, stream) {
  	  var i = -1, n = coordinates.length;
  	  stream.polygonStart();
  	  while (++i < n) streamLine(coordinates[i], stream, 1);
  	  stream.polygonEnd();
  	}

  	function geoStream(object, stream) {
  	  if (object && streamObjectType.hasOwnProperty(object.type)) {
  	    streamObjectType[object.type](object, stream);
  	  } else {
  	    streamGeometry(object, stream);
  	  }
  	}

  	var areaRingSum = adder();

  	var areaSum = adder();

  	function spherical(cartesian) {
  	  return [atan2(cartesian[1], cartesian[0]), asin(cartesian[2])];
  	}

  	function cartesian(spherical) {
  	  var lambda = spherical[0], phi = spherical[1], cosPhi = cos(phi);
  	  return [cosPhi * cos(lambda), cosPhi * sin(lambda), sin(phi)];
  	}

  	function cartesianDot(a, b) {
  	  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  	}

  	function cartesianCross(a, b) {
  	  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  	}

  	// TODO return a
  	function cartesianAddInPlace(a, b) {
  	  a[0] += b[0], a[1] += b[1], a[2] += b[2];
  	}

  	function cartesianScale(vector, k) {
  	  return [vector[0] * k, vector[1] * k, vector[2] * k];
  	}

  	// TODO return d
  	function cartesianNormalizeInPlace(d) {
  	  var l = sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
  	  d[0] /= l, d[1] /= l, d[2] /= l;
  	}
  	var deltaSum = adder();

  	function compose(a, b) {

  	  function compose(x, y) {
  	    return x = a(x, y), b(x[0], x[1]);
  	  }

  	  if (a.invert && b.invert) compose.invert = function(x, y) {
  	    return x = b.invert(x, y), x && a.invert(x[0], x[1]);
  	  };

  	  return compose;
  	}

  	function rotationIdentity(lambda, phi) {
  	  return [lambda > pi ? lambda - tau : lambda < -pi ? lambda + tau : lambda, phi];
  	}

  	rotationIdentity.invert = rotationIdentity;

  	function rotateRadians(deltaLambda, deltaPhi, deltaGamma) {
  	  return (deltaLambda %= tau) ? (deltaPhi || deltaGamma ? compose(rotationLambda(deltaLambda), rotationPhiGamma(deltaPhi, deltaGamma))
  	    : rotationLambda(deltaLambda))
  	    : (deltaPhi || deltaGamma ? rotationPhiGamma(deltaPhi, deltaGamma)
  	    : rotationIdentity);
  	}

  	function forwardRotationLambda(deltaLambda) {
  	  return function(lambda, phi) {
  	    return lambda += deltaLambda, [lambda > pi ? lambda - tau : lambda < -pi ? lambda + tau : lambda, phi];
  	  };
  	}

  	function rotationLambda(deltaLambda) {
  	  var rotation = forwardRotationLambda(deltaLambda);
  	  rotation.invert = forwardRotationLambda(-deltaLambda);
  	  return rotation;
  	}

  	function rotationPhiGamma(deltaPhi, deltaGamma) {
  	  var cosDeltaPhi = cos(deltaPhi),
  	      sinDeltaPhi = sin(deltaPhi),
  	      cosDeltaGamma = cos(deltaGamma),
  	      sinDeltaGamma = sin(deltaGamma);

  	  function rotation(lambda, phi) {
  	    var cosPhi = cos(phi),
  	        x = cos(lambda) * cosPhi,
  	        y = sin(lambda) * cosPhi,
  	        z = sin(phi),
  	        k = z * cosDeltaPhi + x * sinDeltaPhi;
  	    return [
  	      atan2(y * cosDeltaGamma - k * sinDeltaGamma, x * cosDeltaPhi - z * sinDeltaPhi),
  	      asin(k * cosDeltaGamma + y * sinDeltaGamma)
  	    ];
  	  }

  	  rotation.invert = function(lambda, phi) {
  	    var cosPhi = cos(phi),
  	        x = cos(lambda) * cosPhi,
  	        y = sin(lambda) * cosPhi,
  	        z = sin(phi),
  	        k = z * cosDeltaGamma - y * sinDeltaGamma;
  	    return [
  	      atan2(y * cosDeltaGamma + z * sinDeltaGamma, x * cosDeltaPhi + k * sinDeltaPhi),
  	      asin(k * cosDeltaPhi - x * sinDeltaPhi)
  	    ];
  	  };

  	  return rotation;
  	}

  	// Generates a circle centered at [0°, 0°], with a given radius and precision.
  	function circleStream(stream, radius, delta, direction, t0, t1) {
  	  if (!delta) return;
  	  var cosRadius = cos(radius),
  	      sinRadius = sin(radius),
  	      step = direction * delta;
  	  if (t0 == null) {
  	    t0 = radius + direction * tau;
  	    t1 = radius - step / 2;
  	  } else {
  	    t0 = circleRadius(cosRadius, t0);
  	    t1 = circleRadius(cosRadius, t1);
  	    if (direction > 0 ? t0 < t1 : t0 > t1) t0 += direction * tau;
  	  }
  	  for (var point, t = t0; direction > 0 ? t > t1 : t < t1; t -= step) {
  	    point = spherical([cosRadius, -sinRadius * cos(t), -sinRadius * sin(t)]);
  	    stream.point(point[0], point[1]);
  	  }
  	}

  	// Returns the signed angle of a cartesian point relative to [cosRadius, 0, 0].
  	function circleRadius(cosRadius, point) {
  	  point = cartesian(point), point[0] -= cosRadius;
  	  cartesianNormalizeInPlace(point);
  	  var radius = acos(-point[1]);
  	  return ((-point[2] < 0 ? -radius : radius) + tau - epsilon) % tau;
  	}

  	function clipBuffer() {
  	  var lines = [],
  	      line;
  	  return {
  	    point: function(x, y) {
  	      line.push([x, y]);
  	    },
  	    lineStart: function() {
  	      lines.push(line = []);
  	    },
  	    lineEnd: noop,
  	    rejoin: function() {
  	      if (lines.length > 1) lines.push(lines.pop().concat(lines.shift()));
  	    },
  	    result: function() {
  	      var result = lines;
  	      lines = [];
  	      line = null;
  	      return result;
  	    }
  	  };
  	}

  	function clipLine(a, b, x0, y0, x1, y1) {
  	  var ax = a[0],
  	      ay = a[1],
  	      bx = b[0],
  	      by = b[1],
  	      t0 = 0,
  	      t1 = 1,
  	      dx = bx - ax,
  	      dy = by - ay,
  	      r;

  	  r = x0 - ax;
  	  if (!dx && r > 0) return;
  	  r /= dx;
  	  if (dx < 0) {
  	    if (r < t0) return;
  	    if (r < t1) t1 = r;
  	  } else if (dx > 0) {
  	    if (r > t1) return;
  	    if (r > t0) t0 = r;
  	  }

  	  r = x1 - ax;
  	  if (!dx && r < 0) return;
  	  r /= dx;
  	  if (dx < 0) {
  	    if (r > t1) return;
  	    if (r > t0) t0 = r;
  	  } else if (dx > 0) {
  	    if (r < t0) return;
  	    if (r < t1) t1 = r;
  	  }

  	  r = y0 - ay;
  	  if (!dy && r > 0) return;
  	  r /= dy;
  	  if (dy < 0) {
  	    if (r < t0) return;
  	    if (r < t1) t1 = r;
  	  } else if (dy > 0) {
  	    if (r > t1) return;
  	    if (r > t0) t0 = r;
  	  }

  	  r = y1 - ay;
  	  if (!dy && r < 0) return;
  	  r /= dy;
  	  if (dy < 0) {
  	    if (r > t1) return;
  	    if (r > t0) t0 = r;
  	  } else if (dy > 0) {
  	    if (r < t0) return;
  	    if (r < t1) t1 = r;
  	  }

  	  if (t0 > 0) a[0] = ax + t0 * dx, a[1] = ay + t0 * dy;
  	  if (t1 < 1) b[0] = ax + t1 * dx, b[1] = ay + t1 * dy;
  	  return true;
  	}

  	function pointEqual(a, b) {
  	  return abs(a[0] - b[0]) < epsilon && abs(a[1] - b[1]) < epsilon;
  	}

  	function Intersection(point, points, other, entry) {
  	  this.x = point;
  	  this.z = points;
  	  this.o = other; // another intersection
  	  this.e = entry; // is an entry?
  	  this.v = false; // visited
  	  this.n = this.p = null; // next & previous
  	}

  	// A generalized polygon clipping algorithm: given a polygon that has been cut
  	// into its visible line segments, and rejoins the segments by interpolating
  	// along the clip edge.
  	function clipPolygon(segments, compareIntersection, startInside, interpolate, stream) {
  	  var subject = [],
  	      clip = [],
  	      i,
  	      n;

  	  segments.forEach(function(segment) {
  	    if ((n = segment.length - 1) <= 0) return;
  	    var n, p0 = segment[0], p1 = segment[n], x;

  	    // If the first and last points of a segment are coincident, then treat as a
  	    // closed ring. TODO if all rings are closed, then the winding order of the
  	    // exterior ring should be checked.
  	    if (pointEqual(p0, p1)) {
  	      stream.lineStart();
  	      for (i = 0; i < n; ++i) stream.point((p0 = segment[i])[0], p0[1]);
  	      stream.lineEnd();
  	      return;
  	    }

  	    subject.push(x = new Intersection(p0, segment, null, true));
  	    clip.push(x.o = new Intersection(p0, null, x, false));
  	    subject.push(x = new Intersection(p1, segment, null, false));
  	    clip.push(x.o = new Intersection(p1, null, x, true));
  	  });

  	  if (!subject.length) return;

  	  clip.sort(compareIntersection);
  	  link(subject);
  	  link(clip);

  	  for (i = 0, n = clip.length; i < n; ++i) {
  	    clip[i].e = startInside = !startInside;
  	  }

  	  var start = subject[0],
  	      points,
  	      point;

  	  while (1) {
  	    // Find first unvisited intersection.
  	    var current = start,
  	        isSubject = true;
  	    while (current.v) if ((current = current.n) === start) return;
  	    points = current.z;
  	    stream.lineStart();
  	    do {
  	      current.v = current.o.v = true;
  	      if (current.e) {
  	        if (isSubject) {
  	          for (i = 0, n = points.length; i < n; ++i) stream.point((point = points[i])[0], point[1]);
  	        } else {
  	          interpolate(current.x, current.n.x, 1, stream);
  	        }
  	        current = current.n;
  	      } else {
  	        if (isSubject) {
  	          points = current.p.z;
  	          for (i = points.length - 1; i >= 0; --i) stream.point((point = points[i])[0], point[1]);
  	        } else {
  	          interpolate(current.x, current.p.x, -1, stream);
  	        }
  	        current = current.p;
  	      }
  	      current = current.o;
  	      points = current.z;
  	      isSubject = !isSubject;
  	    } while (!current.v);
  	    stream.lineEnd();
  	  }
  	}

  	function link(array) {
  	  if (!(n = array.length)) return;
  	  var n,
  	      i = 0,
  	      a = array[0],
  	      b;
  	  while (++i < n) {
  	    a.n = b = array[i];
  	    b.p = a;
  	    a = b;
  	  }
  	  a.n = b = array[0];
  	  b.p = a;
  	}

  	var clipMax = 1e9;
  	var clipMin = -clipMax;
  	// TODO Use d3-polygon’s polygonContains here for the ring check?
  	// TODO Eliminate duplicate buffering in clipBuffer and polygon.push?

  	function clipExtent(x0, y0, x1, y1) {

  	  function visible(x, y) {
  	    return x0 <= x && x <= x1 && y0 <= y && y <= y1;
  	  }

  	  function interpolate(from, to, direction, stream) {
  	    var a = 0, a1 = 0;
  	    if (from == null
  	        || (a = corner(from, direction)) !== (a1 = corner(to, direction))
  	        || comparePoint(from, to) < 0 ^ direction > 0) {
  	      do stream.point(a === 0 || a === 3 ? x0 : x1, a > 1 ? y1 : y0);
  	      while ((a = (a + direction + 4) % 4) !== a1);
  	    } else {
  	      stream.point(to[0], to[1]);
  	    }
  	  }

  	  function corner(p, direction) {
  	    return abs(p[0] - x0) < epsilon ? direction > 0 ? 0 : 3
  	        : abs(p[0] - x1) < epsilon ? direction > 0 ? 2 : 1
  	        : abs(p[1] - y0) < epsilon ? direction > 0 ? 1 : 0
  	        : direction > 0 ? 3 : 2; // abs(p[1] - y1) < epsilon
  	  }

  	  function compareIntersection(a, b) {
  	    return comparePoint(a.x, b.x);
  	  }

  	  function comparePoint(a, b) {
  	    var ca = corner(a, 1),
  	        cb = corner(b, 1);
  	    return ca !== cb ? ca - cb
  	        : ca === 0 ? b[1] - a[1]
  	        : ca === 1 ? a[0] - b[0]
  	        : ca === 2 ? a[1] - b[1]
  	        : b[0] - a[0];
  	  }

  	  return function(stream) {
  	    var activeStream = stream,
  	        bufferStream = clipBuffer(),
  	        segments,
  	        polygon,
  	        ring,
  	        x__, y__, v__, // first point
  	        x_, y_, v_, // previous point
  	        first,
  	        clean;

  	    var clipStream = {
  	      point: point,
  	      lineStart: lineStart,
  	      lineEnd: lineEnd,
  	      polygonStart: polygonStart,
  	      polygonEnd: polygonEnd
  	    };

  	    function point(x, y) {
  	      if (visible(x, y)) activeStream.point(x, y);
  	    }

  	    function polygonInside() {
  	      var winding = 0;

  	      for (var i = 0, n = polygon.length; i < n; ++i) {
  	        for (var ring = polygon[i], j = 1, m = ring.length, point = ring[0], a0, a1, b0 = point[0], b1 = point[1]; j < m; ++j) {
  	          a0 = b0, a1 = b1, point = ring[j], b0 = point[0], b1 = point[1];
  	          if (a1 <= y1) { if (b1 > y1 && (b0 - a0) * (y1 - a1) > (b1 - a1) * (x0 - a0)) ++winding; }
  	          else { if (b1 <= y1 && (b0 - a0) * (y1 - a1) < (b1 - a1) * (x0 - a0)) --winding; }
  	        }
  	      }

  	      return winding;
  	    }

  	    // Buffer geometry within a polygon and then clip it en masse.
  	    function polygonStart() {
  	      activeStream = bufferStream, segments = [], polygon = [], clean = true;
  	    }

  	    function polygonEnd() {
  	      var startInside = polygonInside(),
  	          cleanInside = clean && startInside,
  	          visible = (segments = merge(segments)).length;
  	      if (cleanInside || visible) {
  	        stream.polygonStart();
  	        if (cleanInside) {
  	          stream.lineStart();
  	          interpolate(null, null, 1, stream);
  	          stream.lineEnd();
  	        }
  	        if (visible) {
  	          clipPolygon(segments, compareIntersection, startInside, interpolate, stream);
  	        }
  	        stream.polygonEnd();
  	      }
  	      activeStream = stream, segments = polygon = ring = null;
  	    }

  	    function lineStart() {
  	      clipStream.point = linePoint;
  	      if (polygon) polygon.push(ring = []);
  	      first = true;
  	      v_ = false;
  	      x_ = y_ = NaN;
  	    }

  	    // TODO rather than special-case polygons, simply handle them separately.
  	    // Ideally, coincident intersection points should be jittered to avoid
  	    // clipping issues.
  	    function lineEnd() {
  	      if (segments) {
  	        linePoint(x__, y__);
  	        if (v__ && v_) bufferStream.rejoin();
  	        segments.push(bufferStream.result());
  	      }
  	      clipStream.point = point;
  	      if (v_) activeStream.lineEnd();
  	    }

  	    function linePoint(x, y) {
  	      var v = visible(x, y);
  	      if (polygon) ring.push([x, y]);
  	      if (first) {
  	        x__ = x, y__ = y, v__ = v;
  	        first = false;
  	        if (v) {
  	          activeStream.lineStart();
  	          activeStream.point(x, y);
  	        }
  	      } else {
  	        if (v && v_) activeStream.point(x, y);
  	        else {
  	          var a = [x_ = Math.max(clipMin, Math.min(clipMax, x_)), y_ = Math.max(clipMin, Math.min(clipMax, y_))],
  	              b = [x = Math.max(clipMin, Math.min(clipMax, x)), y = Math.max(clipMin, Math.min(clipMax, y))];
  	          if (clipLine(a, b, x0, y0, x1, y1)) {
  	            if (!v_) {
  	              activeStream.lineStart();
  	              activeStream.point(a[0], a[1]);
  	            }
  	            activeStream.point(b[0], b[1]);
  	            if (!v) activeStream.lineEnd();
  	            clean = false;
  	          } else if (v) {
  	            activeStream.lineStart();
  	            activeStream.point(x, y);
  	            clean = false;
  	          }
  	        }
  	      }
  	      x_ = x, y_ = y, v_ = v;
  	    }

  	    return clipStream;
  	  };
  	}

  	var sum$1 = adder();

  	function polygonContains(polygon, point) {
  	  var lambda = point[0],
  	      phi = point[1],
  	      normal = [sin(lambda), -cos(lambda), 0],
  	      angle = 0,
  	      winding = 0;

  	  sum$1.reset();

  	  for (var i = 0, n = polygon.length; i < n; ++i) {
  	    if (!(m = (ring = polygon[i]).length)) continue;
  	    var ring,
  	        m,
  	        point0 = ring[m - 1],
  	        lambda0 = point0[0],
  	        phi0 = point0[1] / 2 + quarterPi,
  	        sinPhi0 = sin(phi0),
  	        cosPhi0 = cos(phi0);

  	    for (var j = 0; j < m; ++j, lambda0 = lambda1, sinPhi0 = sinPhi1, cosPhi0 = cosPhi1, point0 = point1) {
  	      var point1 = ring[j],
  	          lambda1 = point1[0],
  	          phi1 = point1[1] / 2 + quarterPi,
  	          sinPhi1 = sin(phi1),
  	          cosPhi1 = cos(phi1),
  	          delta = lambda1 - lambda0,
  	          sign = delta >= 0 ? 1 : -1,
  	          absDelta = sign * delta,
  	          antimeridian = absDelta > pi,
  	          k = sinPhi0 * sinPhi1;

  	      sum$1.add(atan2(k * sign * sin(absDelta), cosPhi0 * cosPhi1 + k * cos(absDelta)));
  	      angle += antimeridian ? delta + sign * tau : delta;

  	      // Are the longitudes either side of the point’s meridian (lambda),
  	      // and are the latitudes smaller than the parallel (phi)?
  	      if (antimeridian ^ lambda0 >= lambda ^ lambda1 >= lambda) {
  	        var arc = cartesianCross(cartesian(point0), cartesian(point1));
  	        cartesianNormalizeInPlace(arc);
  	        var intersection = cartesianCross(normal, arc);
  	        cartesianNormalizeInPlace(intersection);
  	        var phiArc = (antimeridian ^ delta >= 0 ? -1 : 1) * asin(intersection[2]);
  	        if (phi > phiArc || phi === phiArc && (arc[0] || arc[1])) {
  	          winding += antimeridian ^ delta >= 0 ? 1 : -1;
  	        }
  	      }
  	    }
  	  }

  	  // First, determine whether the South pole is inside or outside:
  	  //
  	  // It is inside if:
  	  // * the polygon winds around it in a clockwise direction.
  	  // * the polygon does not (cumulatively) wind around it, but has a negative
  	  //   (counter-clockwise) area.
  	  //
  	  // Second, count the (signed) number of times a segment crosses a lambda
  	  // from the point to the South pole.  If it is zero, then the point is the
  	  // same side as the South pole.

  	  return (angle < -epsilon || angle < epsilon && sum$1 < -epsilon) ^ (winding & 1);
  	}

  	var lengthSum = adder();

  	function identity$1(x) {
  	  return x;
  	}

  	var areaSum$1 = adder();
  	var areaRingSum$1 = adder();
  	var x00;
  	var y00;
  	var x0$1;
  	var y0$1;
  	var areaStream$1 = {
  	  point: noop,
  	  lineStart: noop,
  	  lineEnd: noop,
  	  polygonStart: function() {
  	    areaStream$1.lineStart = areaRingStart$1;
  	    areaStream$1.lineEnd = areaRingEnd$1;
  	  },
  	  polygonEnd: function() {
  	    areaStream$1.lineStart = areaStream$1.lineEnd = areaStream$1.point = noop;
  	    areaSum$1.add(abs(areaRingSum$1));
  	    areaRingSum$1.reset();
  	  },
  	  result: function() {
  	    var area = areaSum$1 / 2;
  	    areaSum$1.reset();
  	    return area;
  	  }
  	};

  	function areaRingStart$1() {
  	  areaStream$1.point = areaPointFirst$1;
  	}

  	function areaPointFirst$1(x, y) {
  	  areaStream$1.point = areaPoint$1;
  	  x00 = x0$1 = x, y00 = y0$1 = y;
  	}

  	function areaPoint$1(x, y) {
  	  areaRingSum$1.add(y0$1 * x - x0$1 * y);
  	  x0$1 = x, y0$1 = y;
  	}

  	function areaRingEnd$1() {
  	  areaPoint$1(x00, y00);
  	}

  	var x0$2 = Infinity;
  	var y0$2 = x0$2;
  	var x1 = -x0$2;
  	var y1 = x1;
  	var boundsStream$1 = {
  	  point: boundsPoint$1,
  	  lineStart: noop,
  	  lineEnd: noop,
  	  polygonStart: noop,
  	  polygonEnd: noop,
  	  result: function() {
  	    var bounds = [[x0$2, y0$2], [x1, y1]];
  	    x1 = y1 = -(y0$2 = x0$2 = Infinity);
  	    return bounds;
  	  }
  	};

  	function boundsPoint$1(x, y) {
  	  if (x < x0$2) x0$2 = x;
  	  if (x > x1) x1 = x;
  	  if (y < y0$2) y0$2 = y;
  	  if (y > y1) y1 = y;
  	}

  	var X0$1 = 0;
  	var Y0$1 = 0;
  	var Z0$1 = 0;
  	var X1$1 = 0;
  	var Y1$1 = 0;
  	var Z1$1 = 0;
  	var X2$1 = 0;
  	var Y2$1 = 0;
  	var Z2$1 = 0;
  	var x00$1;
  	var y00$1;
  	var x0$3;
  	var y0$3;
  	var centroidStream$1 = {
  	  point: centroidPoint$1,
  	  lineStart: centroidLineStart$1,
  	  lineEnd: centroidLineEnd$1,
  	  polygonStart: function() {
  	    centroidStream$1.lineStart = centroidRingStart$1;
  	    centroidStream$1.lineEnd = centroidRingEnd$1;
  	  },
  	  polygonEnd: function() {
  	    centroidStream$1.point = centroidPoint$1;
  	    centroidStream$1.lineStart = centroidLineStart$1;
  	    centroidStream$1.lineEnd = centroidLineEnd$1;
  	  },
  	  result: function() {
  	    var centroid = Z2$1 ? [X2$1 / Z2$1, Y2$1 / Z2$1]
  	        : Z1$1 ? [X1$1 / Z1$1, Y1$1 / Z1$1]
  	        : Z0$1 ? [X0$1 / Z0$1, Y0$1 / Z0$1]
  	        : [NaN, NaN];
  	    X0$1 = Y0$1 = Z0$1 =
  	    X1$1 = Y1$1 = Z1$1 =
  	    X2$1 = Y2$1 = Z2$1 = 0;
  	    return centroid;
  	  }
  	};

  	function centroidPoint$1(x, y) {
  	  X0$1 += x;
  	  Y0$1 += y;
  	  ++Z0$1;
  	}

  	function centroidLineStart$1() {
  	  centroidStream$1.point = centroidPointFirstLine;
  	}

  	function centroidPointFirstLine(x, y) {
  	  centroidStream$1.point = centroidPointLine;
  	  centroidPoint$1(x0$3 = x, y0$3 = y);
  	}

  	function centroidPointLine(x, y) {
  	  var dx = x - x0$3, dy = y - y0$3, z = sqrt(dx * dx + dy * dy);
  	  X1$1 += z * (x0$3 + x) / 2;
  	  Y1$1 += z * (y0$3 + y) / 2;
  	  Z1$1 += z;
  	  centroidPoint$1(x0$3 = x, y0$3 = y);
  	}

  	function centroidLineEnd$1() {
  	  centroidStream$1.point = centroidPoint$1;
  	}

  	function centroidRingStart$1() {
  	  centroidStream$1.point = centroidPointFirstRing;
  	}

  	function centroidRingEnd$1() {
  	  centroidPointRing(x00$1, y00$1);
  	}

  	function centroidPointFirstRing(x, y) {
  	  centroidStream$1.point = centroidPointRing;
  	  centroidPoint$1(x00$1 = x0$3 = x, y00$1 = y0$3 = y);
  	}

  	function centroidPointRing(x, y) {
  	  var dx = x - x0$3,
  	      dy = y - y0$3,
  	      z = sqrt(dx * dx + dy * dy);

  	  X1$1 += z * (x0$3 + x) / 2;
  	  Y1$1 += z * (y0$3 + y) / 2;
  	  Z1$1 += z;

  	  z = y0$3 * x - x0$3 * y;
  	  X2$1 += z * (x0$3 + x);
  	  Y2$1 += z * (y0$3 + y);
  	  Z2$1 += z * 3;
  	  centroidPoint$1(x0$3 = x, y0$3 = y);
  	}

  	function PathContext(context) {
  	  this._context = context;
  	}

  	PathContext.prototype = {
  	  _radius: 4.5,
  	  pointRadius: function(_) {
  	    return this._radius = _, this;
  	  },
  	  polygonStart: function() {
  	    this._line = 0;
  	  },
  	  polygonEnd: function() {
  	    this._line = NaN;
  	  },
  	  lineStart: function() {
  	    this._point = 0;
  	  },
  	  lineEnd: function() {
  	    if (this._line === 0) this._context.closePath();
  	    this._point = NaN;
  	  },
  	  point: function(x, y) {
  	    switch (this._point) {
  	      case 0: {
  	        this._context.moveTo(x, y);
  	        this._point = 1;
  	        break;
  	      }
  	      case 1: {
  	        this._context.lineTo(x, y);
  	        break;
  	      }
  	      default: {
  	        this._context.moveTo(x + this._radius, y);
  	        this._context.arc(x, y, this._radius, 0, tau);
  	        break;
  	      }
  	    }
  	  },
  	  result: noop
  	};

  	var lengthSum$1 = adder();
  	var lengthRing;
  	var x00$2;
  	var y00$2;
  	var x0$4;
  	var y0$4;
  	var lengthStream$1 = {
  	  point: noop,
  	  lineStart: function() {
  	    lengthStream$1.point = lengthPointFirst$1;
  	  },
  	  lineEnd: function() {
  	    if (lengthRing) lengthPoint$1(x00$2, y00$2);
  	    lengthStream$1.point = noop;
  	  },
  	  polygonStart: function() {
  	    lengthRing = true;
  	  },
  	  polygonEnd: function() {
  	    lengthRing = null;
  	  },
  	  result: function() {
  	    var length = +lengthSum$1;
  	    lengthSum$1.reset();
  	    return length;
  	  }
  	};

  	function lengthPointFirst$1(x, y) {
  	  lengthStream$1.point = lengthPoint$1;
  	  x00$2 = x0$4 = x, y00$2 = y0$4 = y;
  	}

  	function lengthPoint$1(x, y) {
  	  x0$4 -= x, y0$4 -= y;
  	  lengthSum$1.add(sqrt(x0$4 * x0$4 + y0$4 * y0$4));
  	  x0$4 = x, y0$4 = y;
  	}

  	function PathString() {
  	  this._string = [];
  	}

  	PathString.prototype = {
  	  _circle: circle$1(4.5),
  	  pointRadius: function(_) {
  	    return this._circle = circle$1(_), this;
  	  },
  	  polygonStart: function() {
  	    this._line = 0;
  	  },
  	  polygonEnd: function() {
  	    this._line = NaN;
  	  },
  	  lineStart: function() {
  	    this._point = 0;
  	  },
  	  lineEnd: function() {
  	    if (this._line === 0) this._string.push("Z");
  	    this._point = NaN;
  	  },
  	  point: function(x, y) {
  	    switch (this._point) {
  	      case 0: {
  	        this._string.push("M", x, ",", y);
  	        this._point = 1;
  	        break;
  	      }
  	      case 1: {
  	        this._string.push("L", x, ",", y);
  	        break;
  	      }
  	      default: {
  	        this._string.push("M", x, ",", y, this._circle);
  	        break;
  	      }
  	    }
  	  },
  	  result: function() {
  	    if (this._string.length) {
  	      var result = this._string.join("");
  	      this._string = [];
  	      return result;
  	    }
  	  }
  	};

  	function circle$1(radius) {
  	  return "m0," + radius
  	      + "a" + radius + "," + radius + " 0 1,1 0," + -2 * radius
  	      + "a" + radius + "," + radius + " 0 1,1 0," + 2 * radius
  	      + "z";
  	}

  	function geoPath(projection, context) {
  	  var pointRadius = 4.5,
  	      projectionStream,
  	      contextStream;

  	  function path(object) {
  	    if (object) {
  	      if (typeof pointRadius === "function") contextStream.pointRadius(+pointRadius.apply(this, arguments));
  	      geoStream(object, projectionStream(contextStream));
  	    }
  	    return contextStream.result();
  	  }

  	  path.area = function(object) {
  	    geoStream(object, projectionStream(areaStream$1));
  	    return areaStream$1.result();
  	  };

  	  path.measure = function(object) {
  	    geoStream(object, projectionStream(lengthStream$1));
  	    return lengthStream$1.result();
  	  };

  	  path.bounds = function(object) {
  	    geoStream(object, projectionStream(boundsStream$1));
  	    return boundsStream$1.result();
  	  };

  	  path.centroid = function(object) {
  	    geoStream(object, projectionStream(centroidStream$1));
  	    return centroidStream$1.result();
  	  };

  	  path.projection = function(_) {
  	    return arguments.length ? (projectionStream = _ == null ? (projection = null, identity$1) : (projection = _).stream, path) : projection;
  	  };

  	  path.context = function(_) {
  	    if (!arguments.length) return context;
  	    contextStream = _ == null ? (context = null, new PathString) : new PathContext(context = _);
  	    if (typeof pointRadius !== "function") contextStream.pointRadius(pointRadius);
  	    return path;
  	  };

  	  path.pointRadius = function(_) {
  	    if (!arguments.length) return pointRadius;
  	    pointRadius = typeof _ === "function" ? _ : (contextStream.pointRadius(+_), +_);
  	    return path;
  	  };

  	  return path.projection(projection).context(context);
  	}

  	function clip(pointVisible, clipLine, interpolate, start) {
  	  return function(rotate, sink) {
  	    var line = clipLine(sink),
  	        rotatedStart = rotate.invert(start[0], start[1]),
  	        ringBuffer = clipBuffer(),
  	        ringSink = clipLine(ringBuffer),
  	        polygonStarted = false,
  	        polygon,
  	        segments,
  	        ring;

  	    var clip = {
  	      point: point,
  	      lineStart: lineStart,
  	      lineEnd: lineEnd,
  	      polygonStart: function() {
  	        clip.point = pointRing;
  	        clip.lineStart = ringStart;
  	        clip.lineEnd = ringEnd;
  	        segments = [];
  	        polygon = [];
  	      },
  	      polygonEnd: function() {
  	        clip.point = point;
  	        clip.lineStart = lineStart;
  	        clip.lineEnd = lineEnd;
  	        segments = merge(segments);
  	        var startInside = polygonContains(polygon, rotatedStart);
  	        if (segments.length) {
  	          if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
  	          clipPolygon(segments, compareIntersection, startInside, interpolate, sink);
  	        } else if (startInside) {
  	          if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
  	          sink.lineStart();
  	          interpolate(null, null, 1, sink);
  	          sink.lineEnd();
  	        }
  	        if (polygonStarted) sink.polygonEnd(), polygonStarted = false;
  	        segments = polygon = null;
  	      },
  	      sphere: function() {
  	        sink.polygonStart();
  	        sink.lineStart();
  	        interpolate(null, null, 1, sink);
  	        sink.lineEnd();
  	        sink.polygonEnd();
  	      }
  	    };

  	    function point(lambda, phi) {
  	      var point = rotate(lambda, phi);
  	      if (pointVisible(lambda = point[0], phi = point[1])) sink.point(lambda, phi);
  	    }

  	    function pointLine(lambda, phi) {
  	      var point = rotate(lambda, phi);
  	      line.point(point[0], point[1]);
  	    }

  	    function lineStart() {
  	      clip.point = pointLine;
  	      line.lineStart();
  	    }

  	    function lineEnd() {
  	      clip.point = point;
  	      line.lineEnd();
  	    }

  	    function pointRing(lambda, phi) {
  	      ring.push([lambda, phi]);
  	      var point = rotate(lambda, phi);
  	      ringSink.point(point[0], point[1]);
  	    }

  	    function ringStart() {
  	      ringSink.lineStart();
  	      ring = [];
  	    }

  	    function ringEnd() {
  	      pointRing(ring[0][0], ring[0][1]);
  	      ringSink.lineEnd();

  	      var clean = ringSink.clean(),
  	          ringSegments = ringBuffer.result(),
  	          i, n = ringSegments.length, m,
  	          segment,
  	          point;

  	      ring.pop();
  	      polygon.push(ring);
  	      ring = null;

  	      if (!n) return;

  	      // No intersections.
  	      if (clean & 1) {
  	        segment = ringSegments[0];
  	        if ((m = segment.length - 1) > 0) {
  	          if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
  	          sink.lineStart();
  	          for (i = 0; i < m; ++i) sink.point((point = segment[i])[0], point[1]);
  	          sink.lineEnd();
  	        }
  	        return;
  	      }

  	      // Rejoin connected segments.
  	      // TODO reuse ringBuffer.rejoin()?
  	      if (n > 1 && clean & 2) ringSegments.push(ringSegments.pop().concat(ringSegments.shift()));

  	      segments.push(ringSegments.filter(validSegment));
  	    }

  	    return clip;
  	  };
  	}

  	function validSegment(segment) {
  	  return segment.length > 1;
  	}

  	// Intersections are sorted along the clip edge. For both antimeridian cutting
  	// and circle clipping, the same comparison is used.
  	function compareIntersection(a, b) {
  	  return ((a = a.x)[0] < 0 ? a[1] - halfPi - epsilon : halfPi - a[1])
  	       - ((b = b.x)[0] < 0 ? b[1] - halfPi - epsilon : halfPi - b[1]);
  	}

  	var clipAntimeridian = clip(
  	  function() { return true; },
  	  clipAntimeridianLine,
  	  clipAntimeridianInterpolate,
  	  [-pi, -halfPi]
  	);

  	// Takes a line and cuts into visible segments. Return values: 0 - there were
  	// intersections or the line was empty; 1 - no intersections; 2 - there were
  	// intersections, and the first and last segments should be rejoined.
  	function clipAntimeridianLine(stream) {
  	  var lambda0 = NaN,
  	      phi0 = NaN,
  	      sign0 = NaN,
  	      clean; // no intersections

  	  return {
  	    lineStart: function() {
  	      stream.lineStart();
  	      clean = 1;
  	    },
  	    point: function(lambda1, phi1) {
  	      var sign1 = lambda1 > 0 ? pi : -pi,
  	          delta = abs(lambda1 - lambda0);
  	      if (abs(delta - pi) < epsilon) { // line crosses a pole
  	        stream.point(lambda0, phi0 = (phi0 + phi1) / 2 > 0 ? halfPi : -halfPi);
  	        stream.point(sign0, phi0);
  	        stream.lineEnd();
  	        stream.lineStart();
  	        stream.point(sign1, phi0);
  	        stream.point(lambda1, phi0);
  	        clean = 0;
  	      } else if (sign0 !== sign1 && delta >= pi) { // line crosses antimeridian
  	        if (abs(lambda0 - sign0) < epsilon) lambda0 -= sign0 * epsilon; // handle degeneracies
  	        if (abs(lambda1 - sign1) < epsilon) lambda1 -= sign1 * epsilon;
  	        phi0 = clipAntimeridianIntersect(lambda0, phi0, lambda1, phi1);
  	        stream.point(sign0, phi0);
  	        stream.lineEnd();
  	        stream.lineStart();
  	        stream.point(sign1, phi0);
  	        clean = 0;
  	      }
  	      stream.point(lambda0 = lambda1, phi0 = phi1);
  	      sign0 = sign1;
  	    },
  	    lineEnd: function() {
  	      stream.lineEnd();
  	      lambda0 = phi0 = NaN;
  	    },
  	    clean: function() {
  	      return 2 - clean; // if intersections, rejoin first and last segments
  	    }
  	  };
  	}

  	function clipAntimeridianIntersect(lambda0, phi0, lambda1, phi1) {
  	  var cosPhi0,
  	      cosPhi1,
  	      sinLambda0Lambda1 = sin(lambda0 - lambda1);
  	  return abs(sinLambda0Lambda1) > epsilon
  	      ? atan((sin(phi0) * (cosPhi1 = cos(phi1)) * sin(lambda1)
  	          - sin(phi1) * (cosPhi0 = cos(phi0)) * sin(lambda0))
  	          / (cosPhi0 * cosPhi1 * sinLambda0Lambda1))
  	      : (phi0 + phi1) / 2;
  	}

  	function clipAntimeridianInterpolate(from, to, direction, stream) {
  	  var phi;
  	  if (from == null) {
  	    phi = direction * halfPi;
  	    stream.point(-pi, phi);
  	    stream.point(0, phi);
  	    stream.point(pi, phi);
  	    stream.point(pi, 0);
  	    stream.point(pi, -phi);
  	    stream.point(0, -phi);
  	    stream.point(-pi, -phi);
  	    stream.point(-pi, 0);
  	    stream.point(-pi, phi);
  	  } else if (abs(from[0] - to[0]) > epsilon) {
  	    var lambda = from[0] < to[0] ? pi : -pi;
  	    phi = direction * lambda / 2;
  	    stream.point(-lambda, phi);
  	    stream.point(0, phi);
  	    stream.point(lambda, phi);
  	  } else {
  	    stream.point(to[0], to[1]);
  	  }
  	}

  	function clipCircle(radius, delta) {
  	  var cr = cos(radius),
  	      smallRadius = cr > 0,
  	      notHemisphere = abs(cr) > epsilon; // TODO optimise for this common case

  	  function interpolate(from, to, direction, stream) {
  	    circleStream(stream, radius, delta, direction, from, to);
  	  }

  	  function visible(lambda, phi) {
  	    return cos(lambda) * cos(phi) > cr;
  	  }

  	  // Takes a line and cuts into visible segments. Return values used for polygon
  	  // clipping: 0 - there were intersections or the line was empty; 1 - no
  	  // intersections 2 - there were intersections, and the first and last segments
  	  // should be rejoined.
  	  function clipLine(stream) {
  	    var point0, // previous point
  	        c0, // code for previous point
  	        v0, // visibility of previous point
  	        v00, // visibility of first point
  	        clean; // no intersections
  	    return {
  	      lineStart: function() {
  	        v00 = v0 = false;
  	        clean = 1;
  	      },
  	      point: function(lambda, phi) {
  	        var point1 = [lambda, phi],
  	            point2,
  	            v = visible(lambda, phi),
  	            c = smallRadius
  	              ? v ? 0 : code(lambda, phi)
  	              : v ? code(lambda + (lambda < 0 ? pi : -pi), phi) : 0;
  	        if (!point0 && (v00 = v0 = v)) stream.lineStart();
  	        // Handle degeneracies.
  	        // TODO ignore if not clipping polygons.
  	        if (v !== v0) {
  	          point2 = intersect(point0, point1);
  	          if (pointEqual(point0, point2) || pointEqual(point1, point2)) {
  	            point1[0] += epsilon;
  	            point1[1] += epsilon;
  	            v = visible(point1[0], point1[1]);
  	          }
  	        }
  	        if (v !== v0) {
  	          clean = 0;
  	          if (v) {
  	            // outside going in
  	            stream.lineStart();
  	            point2 = intersect(point1, point0);
  	            stream.point(point2[0], point2[1]);
  	          } else {
  	            // inside going out
  	            point2 = intersect(point0, point1);
  	            stream.point(point2[0], point2[1]);
  	            stream.lineEnd();
  	          }
  	          point0 = point2;
  	        } else if (notHemisphere && point0 && smallRadius ^ v) {
  	          var t;
  	          // If the codes for two points are different, or are both zero,
  	          // and there this segment intersects with the small circle.
  	          if (!(c & c0) && (t = intersect(point1, point0, true))) {
  	            clean = 0;
  	            if (smallRadius) {
  	              stream.lineStart();
  	              stream.point(t[0][0], t[0][1]);
  	              stream.point(t[1][0], t[1][1]);
  	              stream.lineEnd();
  	            } else {
  	              stream.point(t[1][0], t[1][1]);
  	              stream.lineEnd();
  	              stream.lineStart();
  	              stream.point(t[0][0], t[0][1]);
  	            }
  	          }
  	        }
  	        if (v && (!point0 || !pointEqual(point0, point1))) {
  	          stream.point(point1[0], point1[1]);
  	        }
  	        point0 = point1, v0 = v, c0 = c;
  	      },
  	      lineEnd: function() {
  	        if (v0) stream.lineEnd();
  	        point0 = null;
  	      },
  	      // Rejoin first and last segments if there were intersections and the first
  	      // and last points were visible.
  	      clean: function() {
  	        return clean | ((v00 && v0) << 1);
  	      }
  	    };
  	  }

  	  // Intersects the great circle between a and b with the clip circle.
  	  function intersect(a, b, two) {
  	    var pa = cartesian(a),
  	        pb = cartesian(b);

  	    // We have two planes, n1.p = d1 and n2.p = d2.
  	    // Find intersection line p(t) = c1 n1 + c2 n2 + t (n1 ⨯ n2).
  	    var n1 = [1, 0, 0], // normal
  	        n2 = cartesianCross(pa, pb),
  	        n2n2 = cartesianDot(n2, n2),
  	        n1n2 = n2[0], // cartesianDot(n1, n2),
  	        determinant = n2n2 - n1n2 * n1n2;

  	    // Two polar points.
  	    if (!determinant) return !two && a;

  	    var c1 =  cr * n2n2 / determinant,
  	        c2 = -cr * n1n2 / determinant,
  	        n1xn2 = cartesianCross(n1, n2),
  	        A = cartesianScale(n1, c1),
  	        B = cartesianScale(n2, c2);
  	    cartesianAddInPlace(A, B);

  	    // Solve |p(t)|^2 = 1.
  	    var u = n1xn2,
  	        w = cartesianDot(A, u),
  	        uu = cartesianDot(u, u),
  	        t2 = w * w - uu * (cartesianDot(A, A) - 1);

  	    if (t2 < 0) return;

  	    var t = sqrt(t2),
  	        q = cartesianScale(u, (-w - t) / uu);
  	    cartesianAddInPlace(q, A);
  	    q = spherical(q);

  	    if (!two) return q;

  	    // Two intersection points.
  	    var lambda0 = a[0],
  	        lambda1 = b[0],
  	        phi0 = a[1],
  	        phi1 = b[1],
  	        z;

  	    if (lambda1 < lambda0) z = lambda0, lambda0 = lambda1, lambda1 = z;

  	    var delta = lambda1 - lambda0,
  	        polar = abs(delta - pi) < epsilon,
  	        meridian = polar || delta < epsilon;

  	    if (!polar && phi1 < phi0) z = phi0, phi0 = phi1, phi1 = z;

  	    // Check that the first point is between a and b.
  	    if (meridian
  	        ? polar
  	          ? phi0 + phi1 > 0 ^ q[1] < (abs(q[0] - lambda0) < epsilon ? phi0 : phi1)
  	          : phi0 <= q[1] && q[1] <= phi1
  	        : delta > pi ^ (lambda0 <= q[0] && q[0] <= lambda1)) {
  	      var q1 = cartesianScale(u, (-w + t) / uu);
  	      cartesianAddInPlace(q1, A);
  	      return [q, spherical(q1)];
  	    }
  	  }

  	  // Generates a 4-bit vector representing the location of a point relative to
  	  // the small circle's bounding box.
  	  function code(lambda, phi) {
  	    var r = smallRadius ? radius : pi - radius,
  	        code = 0;
  	    if (lambda < -r) code |= 1; // left
  	    else if (lambda > r) code |= 2; // right
  	    if (phi < -r) code |= 4; // below
  	    else if (phi > r) code |= 8; // above
  	    return code;
  	  }

  	  return clip(visible, clipLine, interpolate, smallRadius ? [0, -radius] : [-pi, radius - pi]);
  	}

  	function transformer(methods) {
  	  return function(stream) {
  	    var s = new TransformStream;
  	    for (var key in methods) s[key] = methods[key];
  	    s.stream = stream;
  	    return s;
  	  };
  	}

  	function TransformStream() {}

  	TransformStream.prototype = {
  	  constructor: TransformStream,
  	  point: function(x, y) { this.stream.point(x, y); },
  	  sphere: function() { this.stream.sphere(); },
  	  lineStart: function() { this.stream.lineStart(); },
  	  lineEnd: function() { this.stream.lineEnd(); },
  	  polygonStart: function() { this.stream.polygonStart(); },
  	  polygonEnd: function() { this.stream.polygonEnd(); }
  	};

  	function fitExtent(projection, extent, object) {
  	  var w = extent[1][0] - extent[0][0],
  	      h = extent[1][1] - extent[0][1],
  	      clip = projection.clipExtent && projection.clipExtent();

  	  projection
  	      .scale(150)
  	      .translate([0, 0]);

  	  if (clip != null) projection.clipExtent(null);

  	  geoStream(object, projection.stream(boundsStream$1));

  	  var b = boundsStream$1.result(),
  	      k = Math.min(w / (b[1][0] - b[0][0]), h / (b[1][1] - b[0][1])),
  	      x = +extent[0][0] + (w - k * (b[1][0] + b[0][0])) / 2,
  	      y = +extent[0][1] + (h - k * (b[1][1] + b[0][1])) / 2;

  	  if (clip != null) projection.clipExtent(clip);

  	  return projection
  	      .scale(k * 150)
  	      .translate([x, y]);
  	}

  	function fitSize(projection, size, object) {
  	  return fitExtent(projection, [[0, 0], size], object);
  	}

  	var maxDepth = 16;
  	var cosMinDistance = cos(30 * radians);
  	// cos(minimum angular distance)

  	function resample(project, delta2) {
  	  return +delta2 ? resample$1(project, delta2) : resampleNone(project);
  	}

  	function resampleNone(project) {
  	  return transformer({
  	    point: function(x, y) {
  	      x = project(x, y);
  	      this.stream.point(x[0], x[1]);
  	    }
  	  });
  	}

  	function resample$1(project, delta2) {

  	  function resampleLineTo(x0, y0, lambda0, a0, b0, c0, x1, y1, lambda1, a1, b1, c1, depth, stream) {
  	    var dx = x1 - x0,
  	        dy = y1 - y0,
  	        d2 = dx * dx + dy * dy;
  	    if (d2 > 4 * delta2 && depth--) {
  	      var a = a0 + a1,
  	          b = b0 + b1,
  	          c = c0 + c1,
  	          m = sqrt(a * a + b * b + c * c),
  	          phi2 = asin(c /= m),
  	          lambda2 = abs(abs(c) - 1) < epsilon || abs(lambda0 - lambda1) < epsilon ? (lambda0 + lambda1) / 2 : atan2(b, a),
  	          p = project(lambda2, phi2),
  	          x2 = p[0],
  	          y2 = p[1],
  	          dx2 = x2 - x0,
  	          dy2 = y2 - y0,
  	          dz = dy * dx2 - dx * dy2;
  	      if (dz * dz / d2 > delta2 // perpendicular projected distance
  	          || abs((dx * dx2 + dy * dy2) / d2 - 0.5) > 0.3 // midpoint close to an end
  	          || a0 * a1 + b0 * b1 + c0 * c1 < cosMinDistance) { // angular distance
  	        resampleLineTo(x0, y0, lambda0, a0, b0, c0, x2, y2, lambda2, a /= m, b /= m, c, depth, stream);
  	        stream.point(x2, y2);
  	        resampleLineTo(x2, y2, lambda2, a, b, c, x1, y1, lambda1, a1, b1, c1, depth, stream);
  	      }
  	    }
  	  }
  	  return function(stream) {
  	    var lambda00, x00, y00, a00, b00, c00, // first point
  	        lambda0, x0, y0, a0, b0, c0; // previous point

  	    var resampleStream = {
  	      point: point,
  	      lineStart: lineStart,
  	      lineEnd: lineEnd,
  	      polygonStart: function() { stream.polygonStart(); resampleStream.lineStart = ringStart; },
  	      polygonEnd: function() { stream.polygonEnd(); resampleStream.lineStart = lineStart; }
  	    };

  	    function point(x, y) {
  	      x = project(x, y);
  	      stream.point(x[0], x[1]);
  	    }

  	    function lineStart() {
  	      x0 = NaN;
  	      resampleStream.point = linePoint;
  	      stream.lineStart();
  	    }

  	    function linePoint(lambda, phi) {
  	      var c = cartesian([lambda, phi]), p = project(lambda, phi);
  	      resampleLineTo(x0, y0, lambda0, a0, b0, c0, x0 = p[0], y0 = p[1], lambda0 = lambda, a0 = c[0], b0 = c[1], c0 = c[2], maxDepth, stream);
  	      stream.point(x0, y0);
  	    }

  	    function lineEnd() {
  	      resampleStream.point = point;
  	      stream.lineEnd();
  	    }

  	    function ringStart() {
  	      lineStart();
  	      resampleStream.point = ringPoint;
  	      resampleStream.lineEnd = ringEnd;
  	    }

  	    function ringPoint(lambda, phi) {
  	      linePoint(lambda00 = lambda, phi), x00 = x0, y00 = y0, a00 = a0, b00 = b0, c00 = c0;
  	      resampleStream.point = linePoint;
  	    }

  	    function ringEnd() {
  	      resampleLineTo(x0, y0, lambda0, a0, b0, c0, x00, y00, lambda00, a00, b00, c00, maxDepth, stream);
  	      resampleStream.lineEnd = lineEnd;
  	      lineEnd();
  	    }

  	    return resampleStream;
  	  };
  	}

  	var transformRadians = transformer({
  	  point: function(x, y) {
  	    this.stream.point(x * radians, y * radians);
  	  }
  	});

  	function projectionMutator(projectAt) {
  	  var project,
  	      k = 150, // scale
  	      x = 480, y = 250, // translate
  	      dx, dy, lambda = 0, phi = 0, // center
  	      deltaLambda = 0, deltaPhi = 0, deltaGamma = 0, rotate, projectRotate, // rotate
  	      theta = null, preclip = clipAntimeridian, // clip angle
  	      x0 = null, y0, x1, y1, postclip = identity$1, // clip extent
  	      delta2 = 0.5, projectResample = resample(projectTransform, delta2), // precision
  	      cache,
  	      cacheStream;

  	  function projection(point) {
  	    point = projectRotate(point[0] * radians, point[1] * radians);
  	    return [point[0] * k + dx, dy - point[1] * k];
  	  }

  	  function invert(point) {
  	    point = projectRotate.invert((point[0] - dx) / k, (dy - point[1]) / k);
  	    return point && [point[0] * degrees, point[1] * degrees];
  	  }

  	  function projectTransform(x, y) {
  	    return x = project(x, y), [x[0] * k + dx, dy - x[1] * k];
  	  }

  	  projection.stream = function(stream) {
  	    return cache && cacheStream === stream ? cache : cache = transformRadians(preclip(rotate, projectResample(postclip(cacheStream = stream))));
  	  };

  	  projection.clipAngle = function(_) {
  	    return arguments.length ? (preclip = +_ ? clipCircle(theta = _ * radians, 6 * radians) : (theta = null, clipAntimeridian), reset()) : theta * degrees;
  	  };

  	  projection.clipExtent = function(_) {
  	    return arguments.length ? (postclip = _ == null ? (x0 = y0 = x1 = y1 = null, identity$1) : clipExtent(x0 = +_[0][0], y0 = +_[0][1], x1 = +_[1][0], y1 = +_[1][1]), reset()) : x0 == null ? null : [[x0, y0], [x1, y1]];
  	  };

  	  projection.scale = function(_) {
  	    return arguments.length ? (k = +_, recenter()) : k;
  	  };

  	  projection.translate = function(_) {
  	    return arguments.length ? (x = +_[0], y = +_[1], recenter()) : [x, y];
  	  };

  	  projection.center = function(_) {
  	    return arguments.length ? (lambda = _[0] % 360 * radians, phi = _[1] % 360 * radians, recenter()) : [lambda * degrees, phi * degrees];
  	  };

  	  projection.rotate = function(_) {
  	    return arguments.length ? (deltaLambda = _[0] % 360 * radians, deltaPhi = _[1] % 360 * radians, deltaGamma = _.length > 2 ? _[2] % 360 * radians : 0, recenter()) : [deltaLambda * degrees, deltaPhi * degrees, deltaGamma * degrees];
  	  };

  	  projection.precision = function(_) {
  	    return arguments.length ? (projectResample = resample(projectTransform, delta2 = _ * _), reset()) : sqrt(delta2);
  	  };

  	  projection.fitExtent = function(extent, object) {
  	    return fitExtent(projection, extent, object);
  	  };

  	  projection.fitSize = function(size, object) {
  	    return fitSize(projection, size, object);
  	  };

  	  function recenter() {
  	    projectRotate = compose(rotate = rotateRadians(deltaLambda, deltaPhi, deltaGamma), project);
  	    var center = project(lambda, phi);
  	    dx = x - center[0] * k;
  	    dy = y + center[1] * k;
  	    return reset();
  	  }

  	  function reset() {
  	    cache = cacheStream = null;
  	    return projection;
  	  }

  	  return function() {
  	    project = projectAt.apply(this, arguments);
  	    projection.invert = project.invert && invert;
  	    return recenter();
  	  };
  	}

  	function conicProjection(projectAt) {
  	  var phi0 = 0,
  	      phi1 = pi / 3,
  	      m = projectionMutator(projectAt),
  	      p = m(phi0, phi1);

  	  p.parallels = function(_) {
  	    return arguments.length ? m(phi0 = _[0] * radians, phi1 = _[1] * radians) : [phi0 * degrees, phi1 * degrees];
  	  };

  	  return p;
  	}

  	function cylindricalEqualAreaRaw(phi0) {
  	  var cosPhi0 = cos(phi0);

  	  function forward(lambda, phi) {
  	    return [lambda * cosPhi0, sin(phi) / cosPhi0];
  	  }

  	  forward.invert = function(x, y) {
  	    return [x / cosPhi0, asin(y * cosPhi0)];
  	  };

  	  return forward;
  	}

  	function conicEqualAreaRaw(y0, y1) {
  	  var sy0 = sin(y0), n = (sy0 + sin(y1)) / 2;

  	  // Are the parallels symmetrical around the Equator?
  	  if (abs(n) < epsilon) return cylindricalEqualAreaRaw(y0);

  	  var c = 1 + sy0 * (2 * n - sy0), r0 = sqrt(c) / n;

  	  function project(x, y) {
  	    var r = sqrt(c - 2 * n * sin(y)) / n;
  	    return [r * sin(x *= n), r0 - r * cos(x)];
  	  }

  	  project.invert = function(x, y) {
  	    var r0y = r0 - y;
  	    return [atan2(x, abs(r0y)) / n * sign(r0y), asin((c - (x * x + r0y * r0y) * n * n) / (2 * n))];
  	  };

  	  return project;
  	}

  	function conicEqualArea() {
  	  return conicProjection(conicEqualAreaRaw)
  	      .scale(155.424)
  	      .center([0, 33.6442]);
  	}

  	function albers() {
  	  return conicEqualArea()
  	      .parallels([29.5, 45.5])
  	      .scale(1070)
  	      .translate([480, 250])
  	      .rotate([96, 0])
  	      .center([-0.6, 38.7]);
  	}

  	function identity$3(x) {
  	  return x;
  	}

  	function transform$1(transform) {
  	  if (transform == null) return identity$3;
  	  var x0,
  	      y0,
  	      kx = transform.scale[0],
  	      ky = transform.scale[1],
  	      dx = transform.translate[0],
  	      dy = transform.translate[1];
  	  return function(input, i) {
  	    if (!i) x0 = y0 = 0;
  	    var j = 2, n = input.length, output = new Array(n);
  	    output[0] = (x0 += input[0]) * kx + dx;
  	    output[1] = (y0 += input[1]) * ky + dy;
  	    while (j < n) output[j] = input[j], ++j;
  	    return output;
  	  };
  	}

  	function reverse(array, n) {
  	  var t, j = array.length, i = j - n;
  	  while (i < --j) t = array[i], array[i++] = array[j], array[j] = t;
  	}

  	function topoFeature(topology, o) {
  	  return o.type === "GeometryCollection"
  	      ? {type: "FeatureCollection", features: o.geometries.map(function(o) { return feature(topology, o); })}
  	      : feature(topology, o);
  	}

  	function feature(topology, o) {
  	  var id = o.id,
  	      bbox = o.bbox,
  	      properties = o.properties == null ? {} : o.properties,
  	      geometry = object$1(topology, o);
  	  return id == null && bbox == null ? {type: "Feature", properties: properties, geometry: geometry}
  	      : bbox == null ? {type: "Feature", id: id, properties: properties, geometry: geometry}
  	      : {type: "Feature", id: id, bbox: bbox, properties: properties, geometry: geometry};
  	}

  	function object$1(topology, o) {
  	  var transformPoint = transform$1(topology.transform),
  	      arcs = topology.arcs;

  	  function arc(i, points) {
  	    if (points.length) points.pop();
  	    for (var a = arcs[i < 0 ? ~i : i], k = 0, n = a.length; k < n; ++k) {
  	      points.push(transformPoint(a[k], k));
  	    }
  	    if (i < 0) reverse(points, n);
  	  }

  	  function point(p) {
  	    return transformPoint(p);
  	  }

  	  function line(arcs) {
  	    var points = [];
  	    for (var i = 0, n = arcs.length; i < n; ++i) arc(arcs[i], points);
  	    if (points.length < 2) points.push(points[0]); // This should never happen per the specification.
  	    return points;
  	  }

  	  function ring(arcs) {
  	    var points = line(arcs);
  	    while (points.length < 4) points.push(points[0]); // This may happen if an arc has only two points.
  	    return points;
  	  }

  	  function polygon(arcs) {
  	    return arcs.map(ring);
  	  }

  	  function geometry(o) {
  	    var type = o.type, coordinates;
  	    switch (type) {
  	      case "GeometryCollection": return {type: type, geometries: o.geometries.map(geometry)};
  	      case "Point": coordinates = point(o.coordinates); break;
  	      case "MultiPoint": coordinates = o.coordinates.map(point); break;
  	      case "LineString": coordinates = line(o.arcs); break;
  	      case "MultiLineString": coordinates = o.arcs.map(line); break;
  	      case "Polygon": coordinates = polygon(o.arcs); break;
  	      case "MultiPolygon": coordinates = o.arcs.map(polygon); break;
  	      default: return null;
  	    }
  	    return {type: type, coordinates: coordinates};
  	  }

  	  return geometry(o);
  	}

  	var commonjsGlobal$$1 = typeof window !== 'undefined' ? window : typeof commonjsGlobal !== 'undefined' ? commonjsGlobal : typeof self !== 'undefined' ? self : {};

  	function createCommonjsModule$$1(fn, module) {
  		return module = { exports: {} }, fn(module, module.exports), module.exports;
  	}

  	var index = createCommonjsModule$$1(function (module, exports) {
  (function (name, root, factory) {
  	  {
  	    module.exports = factory();
  	  }
  	}('dcopy', commonjsGlobal$$1, function () {
  	  /**
  	   * Deep copy objects and arrays
  	   *
  	   * @param {Object/Array} target
  	   * @return {Object/Array} copy
  	   * @api public
  	   */

  	  return function (target) {
  	    var copy = (target instanceof Array) ? [] : {}
  	    ;(function read (target, copy) {
  	      for (var key in target) {
  	        var obj = target[key];
  	        if (obj instanceof Array) {
  	          var value = [];
  	          var last = add(copy, key, value);
  	          read(obj, last);
  	        }
  	        else if (obj instanceof Object && typeof obj !== 'function') {
  	          var value = {};
  	          var last = add(copy, key, value);
  	          read(obj, last);
  	        }
  	        else {
  	          var value = obj;
  	          add(copy, key, value);
  	        }
  	      }
  	    }(target, copy));
  	    return copy
  	  }

  	  /**
  	   * Adds a value to the copy object based on its type
  	   *
  	   * @api private
  	   */

  	  function add (copy, key, value) {
  	    if (copy instanceof Array) {
  	      copy.push(value);
  	      return copy[copy.length - 1]
  	    }
  	    else if (copy instanceof Object) {
  	      copy[key] = value;
  	      return copy[key]
  	    }
  	  }
  	}));
  	});

  	function cartogram() {
  	    /*
  	     * d3.cartogram is a d3-friendly implementation of An Algorithm to Construct
  	     * Continuous Area Cartograms:
  	     *
  	     * <http://lambert.nico.free.fr/tp/biblio/Dougeniketal1985.pdf>
  	     *
  	     * It requires topojson to decode TopoJSON-encoded topologies:
  	     *
  	     * <http://github.com/mbostock/topojson/>
  	     *
  	     * Usage:
  	     * var proj = d3.geo.albersUsa(),
  	     *     path = d3.geoPath()
  	     *        .projection(proj);
  	     * d3.geoPath()
  	     *        .projection(proj);
  	     * var cartogram = d3.cartogram()
  	     *  .projection(proj)
  	     *  .value(function(d) {
  	     *    return Math.random() * 100;
  	     *  });
  	     * d3.json("path/to/topology.json", function(topology) {
  	     *  var features = cartogram.features(topology, topology.objects.OBJECTNAME.geometries);
  	     *  d3.select("svg").selectAll("path")
  	     *    .data(features)
  	     *    .enter()
  	     *    .append("path")
  	     *      .attr("d", path);
  	     * });
  	     */

  	   var iterations = 8,
  	        projection = albers(),
  	        properties = function(id) {
  	            return {};
  	        },
  	        value = function(d) {
  	            return 1;
  	        };

  	  function cartogram(topology, geometries) {

  	    // copy it first
  	    topology = copy(topology);

  	    // objects are projected into screen coordinates

  	    // project the arcs into screen space
  	    var tf = transformer(topology.transform),x,y,len1,i1,out1,len2=topology.arcs.length,i2=0,
  	        projectedArcs = new Array(len2);
  	        while(i2<len2){
  	          x = 0;
  	          y = 0;
  	          len1 = topology.arcs[i2].length;
  	          i1 = 0;
  	          out1 = new Array(len1);
  	          while(i1<len1){
  	            topology.arcs[i2][i1][0] = (x += topology.arcs[i2][i1][0]);
  	            topology.arcs[i2][i1][1] = (y += topology.arcs[i2][i1][1]);
  	            out1[i1] = projection === null ? tf(topology.arcs[i2][i1]) : projection(tf(topology.arcs[i2][i1]));
  	            i1++;
  	          }
  	          projectedArcs[i2++]=out1;
  	          
  	        }

  	    // path with identity projection
  	    var path = geoPath()
  	      .projection(null);

  	    var objects = object(projectedArcs, {type: "GeometryCollection", geometries: geometries})
  	        .geometries.map(function(geom) {
  	          return {
  	            type: "Feature",
  	            id: geom.id,
  	            properties: properties.call(null, geom, topology),
  	            geometry: geom
  	          };
  	        });

  	    var values = objects.map(value),
  	        totalValue = sum(values);

  	    // no iterations; just return the features
  	    if (iterations <= 0) {
  	      return objects;
  	    }

  	    var i = 0;
  	    while (i++ < iterations) {
  	      var areas = objects.map(path.area);
  	          var totalArea = sum(areas),
  	          sizeErrorsTot =0,
  	          sizeErrorsNum=0,
  	          meta = objects.map(function(o, j) {
  	            var area = Math.abs(areas[j]), // XXX: why do we have negative areas?
  	                v = +values[j],
  	                desired = totalArea * v / totalValue,
  	                radius = Math.sqrt(area / Math.PI),
  	                mass = Math.sqrt(desired / Math.PI) - radius,
  	                sizeError = Math.max(area, desired) / Math.min(area, desired);
  	            sizeErrorsTot+=sizeError;
  	            sizeErrorsNum++;
  	            // console.log(o.id, "@", j, "area:", area, "value:", v, "->", desired, radius, mass, sizeError);
  	            return {
  	              id:         o.id,
  	              area:       area,
  	              centroid:   path.centroid(o),
  	              value:      v,
  	              desired:    desired,
  	              radius:     radius,
  	              mass:       mass,
  	              sizeError:  sizeError
  	            };
  	          });

  	      var sizeError = sizeErrorsTot/sizeErrorsNum,
  	          forceReductionFactor = 1 / (1 + sizeError);

  	      // console.log("meta:", meta);
  	      // console.log("  total area:", totalArea);
  	      // console.log("  force reduction factor:", forceReductionFactor, "mean error:", sizeError);

  	      var len1,i1,delta,len2=projectedArcs.length,i2=0,delta,len3,i3,centroid,mass,radius,rSquared,dx,dy,distSquared,dist,Fij;
  	      while(i2<len2){
  	          len1=projectedArcs[i2].length;
  	          i1=0;
  	          while(i1<len1){
  	            // create an array of vectors: [x, y]
  	            delta = [0,0];
  	            len3 = meta.length;
  	            i3=0;
  	            while(i3<len3) {
  	              centroid =  meta[i3].centroid;
  	              mass =      meta[i3].mass;
  	              radius =    meta[i3].radius;
  	              rSquared = (radius*radius);
  	              dx = projectedArcs[i2][i1][0] - centroid[0];
  	              dy = projectedArcs[i2][i1][1] - centroid[1];
  	              distSquared = dx * dx + dy * dy;
  	              dist=Math.sqrt(distSquared);
  	              Fij = (dist > radius)
  	                ? mass * radius / dist
  	                : mass *
  	                  (distSquared / rSquared) *
  	                  (4 - 3 * dist / radius);
  	              delta[0]+=(Fij * cosArctan(dy,dx));
  	              delta[1]+=(Fij * sinArctan(dy,dx));
  	              i3++;
  	            }
  	          projectedArcs[i2][i1][0] += (delta[0]*forceReductionFactor);
  	          projectedArcs[i2][i1][1] += (delta[1]*forceReductionFactor);
  	          i1++;
  	        }
  	        i2++;
  	      }

  	      // break if we hit the target size error
  	      if (sizeError <= 1) break;
  	    }

  	    return {
  	      features: objects,
  	      arcs: projectedArcs
  	    };
  	  }      

  	  function cosArctan(dx,dy) {
  	    if (dy===0) return 0;
  	    var div = dx/dy;
  	    return (dy>0)?
  	      (1/Math.sqrt(1+(div*div))):
  	      (-1/Math.sqrt(1+(div*div)));
  	  }

  	  function sinArctan(dx,dy){
  	    if (dy===0) return 1;
  	    var div = dx/dy;
  	    return (dy>0)?
  	      (div/Math.sqrt(1+(div*div))):
  	      (-div/Math.sqrt(1+(div*div)));
  	  }

  	  function copy(o) {
  	    return (o instanceof Array)
  	      ? o.map(copy)
  	      : (typeof o === "string" || typeof o === "number")
  	        ? o
  	        : copyObject(o);
  	  }
  	    
  	  function copyObject(o) {
  	    var obj = {};
  	    for (var k in o) obj[k] = copy(o[k]);
  	    return obj;
  	  }

  	  function object(arcs, o) {
  	    function arc(i, points) {
  	      if (points.length) points.pop();
  	      for (var a = arcs[i < 0 ? ~i : i], k = 0, n = a.length; k < n; ++k) {
  	        points.push(a[k]);
  	      }
  	      if (i < 0) reverse(points, n);
  	    }

  	    function line(arcs) {
  	      var points = [];
  	      for (var i = 0, n = arcs.length; i < n; ++i) arc(arcs[i], points);
  	      return points;
  	    }

  	    function polygon(arcs) {
  	      return arcs.map(line);
  	    }

  	    function geometry(o) {
  	      o = Object.create(o);
  	      o.coordinates = geometryType[o.type](o.arcs);
  	      return o;
  	    }

  	    var geometryType = {
  	        LineString: line,
  	        MultiLineString: polygon,
  	        Polygon: polygon,
  	        MultiPolygon: function(arcs) { return arcs.map(polygon); }
  	    };

  	    return o.type === "GeometryCollection"
  	          ? (o = Object.create(o), o.geometries = o.geometries.map(geometry), o)
  	          : geometry(o);
  	  }

  	  function reverse(array, n) {
  	      var t, j = array.length, i = j - n; while (i < --j) t = array[i], array[i++] = array[j], array[j] = t;
  	  }

  	     // for convenience
  	  cartogram.path = geoPath()
  	        .projection(null);

  	  cartogram.iterations = function(i) {
  	        if (arguments.length) {
  	          iterations = i;
  	          return cartogram;
  	        } else {
  	          return iterations;
  	        }
  	      };

  	  cartogram.value = function(v) {
  	        if (arguments.length) {
  	          value = typeof v === "function" ? v : constant(v);
  	          return cartogram;
  	        } else {
  	          return value;
  	        }
  	      };

  	  cartogram.projection = function(p) {
  	        if (arguments.length) {
  	          projection = p;
  	          return cartogram;
  	        } else {
  	          return projection;
  	        }
  	      };

  	  cartogram.feature = function(topology, geom) {
  	        return {
  	          type: "Feature",
  	          id: geom.id,
  	          properties: properties.call(null, geom, topology),
  	          geometry: {
  	            type: geom.type,
  	            coordinates: topoFeature(topology, geom).geometry.coordinates
  	          }
  	        };
  	      };

  	  cartogram.features = function(topo, geometries) {
  	    return geometries.map(function(f) {
  	      return cartogram.feature(topo, f);
  	    });
  	  };

  	  cartogram.properties = function(props) {
  	    if (arguments.length) {
  	      properties = typeof props === "function" ? props : constant(props);
  	      return cartogram;
  	    } else {
  	      return properties;
  	    }
  	  };

  	  function constant(x) {
  	    return function() {
  	      return x;
  	    };
  	  }

  	  var transformer = cartogram.transformer = function(tf) {
  	      var kx = tf.scale[0],
  	          ky = tf.scale[1],
  	          dx = tf.translate[0],
  	          dy = tf.translate[1];

  	      function transform(c) {
  	        return [c[0] * kx + dx, c[1] * ky + dy];
  	      }

  	      transform.invert = function(c) {
  	        return [(c[0] - dx) / kx, (c[1]- dy) / ky];
  	      };

  	      return transform;
  	    };

  	  return cartogram;
  	}
  	exports.cartogram = cartogram;

  	Object.defineProperty(exports, '__esModule', { value: true });

  }));
  });

  var cartogramModule = unwrapExports(topogram);

  var kapsule_min = createCommonjsModule(function (module, exports) {
  !function(n,t){module.exports=t();}("undefined"!=typeof self?self:commonjsGlobal,function(){return function(n){var t={};function e(r){if(t[r])return t[r].exports;var o=t[r]={i:r,l:!1,exports:{}};return n[r].call(o.exports,o,o.exports,e),o.l=!0,o.exports}return e.m=n,e.c=t,e.d=function(n,t,r){e.o(n,t)||Object.defineProperty(n,t,{configurable:!1,enumerable:!0,get:r});},e.n=function(n){var t=n&&n.__esModule?function(){return n.default}:function(){return n};return e.d(t,"a",t),t},e.o=function(n,t){return Object.prototype.hasOwnProperty.call(n,t)},e.p="",e(e.s=0)}([function(n,t,e){var r,o,i;u=function(n,t,e){Object.defineProperty(t,"__esModule",{value:!0}),t.default=function(n){var t=n.stateInit,e=void 0===t?function(){return {}}:t,r=n.props,a=void 0===r?{}:r,f=n.methods,l=void 0===f?{}:f,c=n.aliases,s=void 0===c?{}:c,d=n.init,p=void 0===d?function(){}:d,v=n.update,h=void 0===v?function(){}:v,y=Object.keys(a).map(function(n){return new u(n,a[n])});return function(){var n=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=Object.assign({},e instanceof Function?e():e,{initialised:!1});function r(t){return u(t,n),a(),r}var u=function(n,e){p.call(r,n,t,e),t.initialised=!0;},a=(0, o.default)(function(){t.initialised&&h.call(r,t);},1);return y.forEach(function(n){r[n.name]=function(n){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1],o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:function(n,t){};return function(i){return arguments.length?(t[n]=i,o.call(r,i,t),e&&a(),r):t[n]}}(n.name,n.triggerUpdate,n.onChange);}),Object.keys(l).forEach(function(n){r[n]=function(){for(var e,o=arguments.length,i=Array(o),u=0;u<o;u++)i[u]=arguments[u];return (e=l[n]).call.apply(e,[r,t].concat(i))};}),Object.entries(s).forEach(function(n){var t=i(n,2),e=t[0],o=t[1];return r[e]=r[o]}),r.resetProps=function(){return y.forEach(function(n){r[n.name](n.defaultVal);}),r},r.resetProps(),t._rerender=a,r}};var r,o=(r=e,r&&r.__esModule?r:{default:r});var i=function(){return function(n,t){if(Array.isArray(n))return n;if(Symbol.iterator in Object(n))return function(n,t){var e=[],r=!0,o=!1,i=void 0;try{for(var u,a=n[Symbol.iterator]();!(r=(u=a.next()).done)&&(e.push(u.value),!t||e.length!==t);r=!0);}catch(n){o=!0,i=n;}finally{try{!r&&a.return&&a.return();}finally{if(o)throw i}}return e}(n,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}();var u=function n(t,e){var r=e.default,o=void 0===r?null:r,i=e.triggerUpdate,u=void 0===i||i,a=e.onChange,f=void 0===a?function(n,t){}:a;!function(n,t){if(!(n instanceof t))throw new TypeError("Cannot call a class as a function")}(this,n),this.name=t,this.defaultVal=o,this.triggerUpdate=u,this.onChange=f;};n.exports=t.default;},o=[n,t,e(1)],void 0===(i="function"==typeof(r=u)?r.apply(t,o):r)||(n.exports=i);var u;},function(n,t){n.exports=function(n,t,e){var r,o,i,u,a;null==t&&(t=100);function f(){var l=Date.now()-u;l<t&&l>=0?r=setTimeout(f,t-l):(r=null,e||(a=n.apply(i,o),i=o=null));}var l=function(){i=this,o=arguments,u=Date.now();var l=e&&!r;return r||(r=setTimeout(f,t)),l&&(a=n.apply(i,o),i=o=null),a};return l.clear=function(){r&&(clearTimeout(r),r=null);},l.flush=function(){r&&(a=n.apply(i,o),i=o=null,clearTimeout(r),r=null);},l};}])});
  });

  var Kapsule = unwrapExports(kapsule_min);
  var kapsule_min_1 = kapsule_min.Kapsule;

  var accessor_min = createCommonjsModule(function (module, exports) {
  !function(e,t){module.exports=t();}(commonjsGlobal,function(){return function(e){function t(o){if(n[o])return n[o].exports;var r=n[o]={i:o,l:!1,exports:{}};return e[o].call(r.exports,r,r.exports,t),r.l=!0,r.exports}var n={};return t.m=e,t.c=n,t.d=function(e,n,o){t.o(e,n)||Object.defineProperty(e,n,{configurable:!1,enumerable:!0,get:o});},t.n=function(e){var n=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(n,"a",n),n},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="",t(t.s=0)}([function(e,t,n){var o,r,u;!function(n,c){r=[e,t],void 0!==(u="function"==typeof(o=c)?o.apply(t,r):o)&&(e.exports=u);}(0,function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.default=function(e){return e instanceof Function?e:"string"==typeof e?function(t){return t[e]}:function(t){return e}},e.exports=t.default;});}])});
  });

  var accessorFn = unwrapExports(accessor_min);
  var accessor_min_1 = accessor_min.accessorFn;

  var d3Cartogram = cartogramModule.cartogram; // Unwrap CJS from ES module

  var ANIMATION_DURATION = 1200;

  var cartogram = new Kapsule({

    props: {
      width: { default: window.innerWidth },
      height: { default: window.innerHeight },
      iterations: { default: 20 },
      projection: { default: geoMercator().scale(Math.min((window.innerWidth - 3) / (2 * Math.PI), (window.innerHeight - 3) / (1.2 * Math.PI))).translate([window.innerWidth / 2, window.innerHeight / 1.5])
      },
      topoJson: {},
      topoObjectName: {},
      value: { default: 1 },
      color: { default: 'lightgrey' },
      label: { default: '' },
      valFormatter: { default: function _default(n) {
          return n;
        } },
      units: { default: '' },
      tooltipContent: { default: function _default(d) {
          return '';
        } },
      onClick: { default: function _default(d) {} }
    },

    init: function init(domNode, state) {
      state.cartogram = d3Cartogram().properties(function (d) {
        return d.properties;
      });

      // Dom
      state.svg = select(domNode).append('svg').attr('class', 'cartogram');

      // tooltips
      state.tooltip = select('body').append('div').attr('class', 'chart-tooltip cartogram-tooltip');

      // tooltip cleanup on unmount
      domNode.addEventListener('DOMNodeRemoved', function (e) {
        if (e.target === this) {
          state.tooltip.remove();
        }
      });

      state.svg.on('mousemove', function () {
        state.tooltip.style('left', event.pageX + 'px').style('top', event.pageY + 'px');
      });
    },
    update: function update(state) {
      var valueOf = accessorFn(state.value);
      var colorOf = accessorFn(state.color);

      state.svg.attr('width', state.width).attr('height', state.height);

      if (!state.topoJson) return; // No features to render

      var topoObject = state.topoJson.objects[state.topoObjectName] || Object.values(state.topoJson.objects)[0];
      if (!topoObject) {
        console.warn('Unable to find topology object in TopoJson');
        return;
      }

      state.cartogram.projection(state.projection).value(valueOf);

      var features = state.svg.selectAll('path.feature').data(state.cartogram.iterations(1) // Initialize new features non-distorted
      (state.topoJson, topoObject.geometries).features);

      features.exit().remove();

      var newFeatures = features.enter().append('path').attr('class', 'feature').style('fill', 'lightgrey').attr('d', state.cartogram.path).on('mouseover', function (feature) {
        var valueOf = accessorFn(state.value);
        var labelOf = accessorFn(state.label);
        var tooltipContentOf = accessorFn(state.tooltipContent);

        var label = labelOf(feature);
        var extraContent = tooltipContentOf(feature);
        state.tooltip.style('display', 'inline');
        state.tooltip.html('\n          ' + (label ? '<b>' + label + '</b>:' : '') + '\n          ' + state.valFormatter(valueOf(feature)) + '\n          ' + state.units + '\n          ' + (extraContent ? '<br/><br/>' + extraContent : '') + '\n        ');
      }).on('mouseout', function () {
        state.tooltip.style('display', 'none');
      }).on('click', function (d) {
        return state.onClick(d);
      });

      features.merge(newFeatures).data(state.cartogram.iterations(state.iterations) // distort all features
      (state.topoJson, topoObject.geometries).features).transition().duration(ANIMATION_DURATION).style('fill', colorOf).attr('d', state.cartogram.path);
    }
  });

  function styleInject(css, ref) {
    if ( ref === void 0 ) ref = {};
    var insertAt = ref.insertAt;

    if (!css || typeof document === 'undefined') { return; }

    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';

    if (insertAt === 'top') {
      if (head.firstChild) {
        head.insertBefore(style, head.firstChild);
      } else {
        head.appendChild(style);
      }
    } else {
      head.appendChild(style);
    }

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }

  var css = ".cartogram .feature {\n    stroke: darkgrey;\n    transition: fill-opacity .7s;\n    cursor: pointer;\n}\n\n.cartogram .feature:hover {\n    fill-opacity: 0.6;\n    transition: fill-opacity .1s;\n}\n\n.cartogram-tooltip {\n    display: none;\n    position: absolute;\n    max-width: 320px;\n    margin-top: 20px;\n    margin-left: 8px;\n    padding: 5px;\n    border-radius: 3px;\n    font: 11px sans-serif;\n    color: #eee;\n    background: rgba(0, 0, 0, 0.65);\n    pointer-events: none;\n}";
  styleInject(css);

  return cartogram;

})));
//# sourceMappingURL=cartogram-chart.js.map
