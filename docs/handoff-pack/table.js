/* ══════════════════════════════════════════════════════════════════════════
   TABLE CONTROLS · sort, filter, search, pagination — one implementation

   Every controlled table in this product reads from here, so the keyboard
   behaviour, the counts and the empty states are the same wherever a table
   appears. Three positions are load-bearing:

   1. THE COUNT IS COMPUTED FROM THE ROWS THAT SURVIVED, never typed beside a
      list. A figure that disagrees with the rows under it is the defect this
      file exists to prevent, and it is the same rule the command palette
      already holds to.

   2. A FILTER NARROWS AND SAYS SO. Narrowing is silent nowhere: while any
      filter or search is live the toolbar prints what was removed, because a
      table showing four of forty rows with no statement of that is a table
      that lies by omission.

   3. SORT IS A VIEW, NEVER A FACT. The order a table is read in is the
      reader's; it never changes what a row says, and it is not recorded.

   A short, fixed, explanatory table — the refusals on the sandbox, the five
   steps of an escalation — deliberately gets no controls. A pager under three
   rows of prose is furniture.
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var DEFAULT_PER = 10;
  /* A COLUMN WITH FEW DISTINCT VALUES IS A CHOICE, not a text box: offering a
     free-text filter over four known values invites a typo that reads as an
     empty result. Above this, it is a text box. */
  var PICK_MAX = 7;

  function plain(v) {
    if (v === null || v === undefined) return '';
    return String(v);
  }

  /* SORTING READS THE FIGURE, NOT THE STRING. "1,806" and "412,900.00" sort as
     numbers or a money column orders lexically and the largest amount lands in
     the middle. A value that is not a figure falls back to text. */
  function asNumber(s) {
    var t = plain(s).replace(/[\s,]/g, '');
    if (!t || t === '—' || t === '\u2014') return null;
    var m = t.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    if (!/^[-\d.,%\u00a0]+$/.test(t.replace(/[a-zA-Z$£€]/g, ''))) return null;
    var n = parseFloat(m[0]);
    return isNaN(n) ? null : n;
  }

  function cmp(a, b) {
    var na = asNumber(a), nb = asNumber(b);
    if (na !== null && nb !== null) return na - nb;
    return plain(a).toLowerCase().localeCompare(plain(b).toLowerCase());
  }

  function distinct(rows, key) {
    var seen = [], i, v;
    for (i = 0; i < rows.length; i++) {
      v = plain(rows[i][key]);
      if (v && seen.indexOf(v) < 0) seen.push(v);
    }
    return seen.sort(function (x, y) { return x.localeCompare(y); });
  }

  /* ── view(cfg) ────────────────────────────────────────────────────────────
     cfg = {
       id      a stable key, so one surface can hold several tables
       rows    the full row list, already shaped for the template
       cols    [{key, label, sortable, filterable, hide}]
       state   {tq, tsort, tfilter, tpage, tfopen} from the component
       set     (patch) => void — merges into that state
       per     rows per page (default 10)
       search  keys searched by the text box (default: every col key)
     }
     Returns everything a template needs and nothing it has to compute. */
  function view(cfg) {
    var rows = cfg.rows || [];
    var cols = (cfg.cols || []).filter(function (c) { return !c.hide; });
    var st = cfg.state || {};
    var id = cfg.id;
    var per = cfg.per || DEFAULT_PER;
    var q = plain((st.tq || {})[id]).trim().toLowerCase();
    var sort = (st.tsort || {})[id] || null;
    var filters = ((st.tfilter || {})[id]) || {};
    var page = ((st.tpage || {})[id]) || 0;
    var fopen = !!((st.tfopen || {})[id]);
    var searchKeys = cfg.search || cols.map(function (c) { return c.key; });
    var total = rows.length;

    var kept = rows.filter(function (r) {
      var k, want, got;
      for (k in filters) {
        if (!filters[k]) continue;
        want = plain(filters[k]).toLowerCase();
        got = plain(r[k]).toLowerCase();
        if (got.indexOf(want) < 0) return false;
      }
      if (!q) return true;
      for (var i = 0; i < searchKeys.length; i++) {
        if (plain(r[searchKeys[i]]).toLowerCase().indexOf(q) >= 0) return true;
      }
      return false;
    });

    if (sort) {
      kept = kept.slice().sort(function (a, b) {
        var d = cmp(a[sort.key], b[sort.key]);
        return sort.dir === 'desc' ? -d : d;
      });
    }

    var shown = kept.length;
    var pages = Math.max(1, Math.ceil(shown / per));
    if (page > pages - 1) page = pages - 1;
    var from = page * per;
    var slice = kept.slice(from, from + per);
    var filtered = shown !== total;
    var liveFilters = Object.keys(filters).filter(function (k) { return !!filters[k]; });

    function patch(branch, value) {
      var next = {};
      var cur = st[branch] || {};
      var copy = {};
      for (var k in cur) copy[k] = cur[k];
      copy[id] = value;
      next[branch] = copy;
      cfg.set(next);
    }
    function toPage(n) { patch('tpage', Math.max(0, Math.min(pages - 1, n))); }

    return {
      /* the rows to render, already searched, filtered, sorted and paged */
      rows: slice,
      any: slice.length > 0,
      empty: slice.length === 0,

      /* HEADERS CARRY THE CONTROLS. aria-sort goes on the th; the button
         inside it is what a pointer and a keyboard both press. */
      headers: cols.map(function (c) {
        var on = sort && sort.key === c.key;
        var dir = on ? sort.dir : null;
        return {
          label: c.label,
          sortable: c.sortable !== false,
          ariaSort: on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none',
          indicator: on ? (dir === 'asc' ? '\u2191' : '\u2193') : '',
          hint: on
            ? c.label + ', sorted ' + (dir === 'asc' ? 'ascending' : 'descending') + '. Press to reverse.'
            : 'Sort by ' + c.label.toLowerCase(),
          sortBy: function () {
            if (c.sortable === false) return;
            patch('tsort', on && dir === 'asc' ? { key: c.key, dir: 'desc' }
              : on && dir === 'desc' ? null
              : { key: c.key, dir: 'asc' });
          }
        };
      }),

      /* A FILTER ROW UNDER THE HEADERS, and it is closed until asked for:
         a row of empty inputs above every table is a row of noise. */
      filterOpen: fopen,
      filterPressed: fopen ? 'true' : 'false',
      toggleFilter: function () { patch('tfopen', !fopen); },
      filterLabel: liveFilters.length
        ? 'Filters · ' + liveFilters.length
        : 'Filter',
      filterCells: cols.map(function (c) {
        var values = c.filterable === false ? [] : distinct(rows, c.key);
        var pick = values.length > 1 && values.length <= PICK_MAX;
        return {
          key: c.key,
          label: c.label,
          can: c.filterable !== false,
          isPick: pick,
          isText: !pick && c.filterable !== false,
          value: plain(filters[c.key]),
          options: [{ label: 'Any ' + c.label.toLowerCase(), value: '' }].concat(
            values.map(function (v) { return { label: v, value: v }; })),
          set: function (e) {
            var v = e && e.target ? e.target.value : '';
            var nf = {};
            for (var k in filters) nf[k] = filters[k];
            nf[c.key] = v;
            patch('tfilter', nf);
            patch('tpage', 0);
          }
        };
      }),
      clearFilters: function () { patch('tfilter', {}); patch('tpage', 0); },
      hasFilters: liveFilters.length > 0 || !!q,

      /* SEARCH IS TEXT ACROSS THE ROW, and it says which columns it read. */
      query: plain((st.tq || {})[id]),
      onQuery: function (e) {
        patch('tq', e && e.target ? e.target.value : '');
        patch('tpage', 0);
      },
      searchLabel: 'Search these rows',
      searchNote: 'Reads ' + searchKeys.length + ' columns of each row',

      /* THE COUNT, COMPUTED — and it states the narrowing rather than hiding
         it. This is the sentence a reader needs to trust a short table. */
      count: filtered
        ? shown + ' of ' + total + ' rows'
        : (total === 1 ? '1 row' : total + ' rows'),
      narrowed: filtered,
      narrowedLine: filtered
        ? (total - shown) + ' of ' + total + ' rows are hidden by a filter or a search'
        : '',
      emptyLine: 'No row matches. ' + (filtered
        ? 'Clear the filter to see all ' + total + '.'
        : 'There is nothing here yet.'),

      /* PAGINATION. One page is not a pager: the controls are absent rather
         than drawn and dead. */
      paged: pages > 1,
      pageLine: 'Page ' + (page + 1) + ' of ' + pages,
      rangeLine: shown ? (from + 1) + '\u2013' + Math.min(from + per, shown) + ' of ' + shown : '0',
      canPrev: page > 0,
      canNext: page < pages - 1,
      prevOff: page > 0 ? undefined : 'true',
      nextOff: page < pages - 1 ? undefined : 'true',
      prev: function () { toPage(page - 1); },
      next: function () { toPage(page + 1); },
      first: function () { toPage(0); },
      last: function () { toPage(pages - 1); }
    };
  }

  root.RTable = { view: view, cmp: cmp, asNumber: asNumber };
})(typeof window !== 'undefined' ? window : this);
