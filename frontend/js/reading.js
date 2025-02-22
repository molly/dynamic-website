import 'core-js/actual/url-search-params/index.js';
import '../../css/reading.css';

function getListFromUrl(url = null, query) {
  if (!url) {
    url = new URL(window.location);
  }
  const urlParam = url.searchParams.get(query);
  if (urlParam) {
    return decodeURIComponent(urlParam).split('-');
  }
  return [];
}

function urlEncodeList(list) {
  const listStr = Array.isArray(list) ? list.join('-') : list;
  return encodeURIComponent(listStr.replace(' ', '_'));
}

function onMultiSelectClick(field) {
  return function (value) {
    // Set URL param
    const url = new URL(window.location);
    const values = getListFromUrl(url, field);
    if (!values.length) {
      url.searchParams.set(field, urlEncodeList(value));
    } else {
      let newValuesArr;
      if (values.includes(value)) {
        newValuesArr = values.filter(function (t) {
          return t !== value;
        });
      } else {
        newValuesArr = values.slice();
        newValuesArr.push(value);
      }
      const newQueryString = urlEncodeList(newValuesArr);
      if (newQueryString == '') {
        url.searchParams.delete(field);
      } else {
        url.searchParams.set(field, newQueryString);
      }
    }
    url.searchParams.delete('page');
    window.location.replace(url);
  };
}

const onTagClick = onMultiSelectClick('tags');
const onStatusClick = onMultiSelectClick('status');

function onCheckboxClick(value) {
  const url = new URL(window.location);
  if (url.searchParams.has(value)) {
    url.searchParams.delete(value);
  } else {
    url.searchParams.set(value, 'true');
  }
  url.searchParams.delete('page');
  window.location.replace(url);
}

function onPageChangeClick(pageNumber) {
  const url = new URL(window.location);
  url.searchParams.set('page', pageNumber);
  window.location.replace(url);
}

function changeSortOrder(order) {
  const url = new URL(window.location);
  if (order === 'reverse') {
    url.searchParams.set('order', 'reverse');
  } else {
    url.searchParams.delete('order');
  }
  url.searchParams.delete('page');
  window.location.replace(url);
}

function clearFilters() {
  const url = new URL(window.location);
  url.search = '';
  window.location.replace(url);
}

function onFiltersSubmit(e) {
  e.preventDefault();
  const query = document.getElementById('search-input').value;
  const url = new URL(window.location);
  if (url.searchParams.has('search') && !query) {
    url.searchParams.delete('search');
    url.searchParams.delete('page');
    window.location.replace(url);
  } else if (query) {
    url.searchParams.set('search', query);
    url.searchParams.delete('page');
    window.location.replace(url);
  }
}

(function () {
  // Filter handlers
  document
    .getElementById('filters')
    ?.addEventListener('submit', onFiltersSubmit);
  document.querySelectorAll('button.category-tag').forEach(function (tag) {
    tag.addEventListener('click', function () {
      onTagClick(this.getAttribute('data-tag'));
    });
  });
  document.querySelectorAll('button.status-tag').forEach(function (tag) {
    tag.addEventListener('click', function () {
      onStatusClick(this.getAttribute('data-tag'));
    });
  });
  document
    .getElementById('clear-filters')
    ?.addEventListener('click', clearFilters);
  document.getElementById('sort-order')?.addEventListener('click', function () {
    const newOrder =
      this.getAttribute('data-order') === 'reverse' ? 'normal' : 'reverse';
    changeSortOrder(newOrder);
  });
  document
    .querySelectorAll('input[type="checkbox"][name="wikipedia"]')
    .forEach(function (checkbox) {
      checkbox.addEventListener('click', function () {
        onCheckboxClick(this.id);
      });
    });
  document
    .querySelectorAll('input[type="checkbox"][name="ficNonfic"]')
    .forEach(function (checkbox) {
      checkbox.addEventListener('click', function () {
        onCheckboxClick(this.id);
      });
    });

  // Pagination handlers
  if (document.getElementById('paginator')) {
    document
      .getElementById('jump-to-start')
      ?.addEventListener('click', function () {
        onPageChangeClick(1);
      });
    document.querySelectorAll('.page-number-button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onPageChangeClick(this.getAttribute('data-page-number'));
      });
    });
    document
      .getElementById('jump-to-end')
      ?.addEventListener('click', function () {
        onPageChangeClick(this.getAttribute('data-last-page'));
      });
  }
})();
