import 'core-js/actual/url-search-params/index.js';
import '../../css/reading.css';

(function () {
  document.getElementById('filters').addEventListener('submit', function (e) {
    e.preventDefault();
    var query = document.getElementById('search-input').value;
    var url = new URL(window.location);
    if (url.searchParams.has('search') && !query) {
      url.searchParams.delete('search');
      url.searchParams.delete('page');
      window.location.replace(url);
    } else if (query) {
      url.searchParams.set('search', query);
      url.searchParams.delete('page');
      window.location.replace(url);
    }
  });
})();

function getListFromUrl(url = null, query) {
  if (!url) {
    url = new URL(window.location);
  }
  var urlParam = url.searchParams.get(query);
  if (urlParam) {
    return decodeURIComponent(urlParam).split('-');
  }
  return [];
}

function urlEncodeList(list) {
  var listStr = Array.isArray(list) ? list.join('-') : list;
  return encodeURIComponent(listStr.replace(' ', '_'));
}

function onMultiSelectClick(field) {
  return function (value) {
    // Set URL param
    var url = new URL(window.location);
    var values = getListFromUrl(url, field);
    if (!values.length) {
      url.searchParams.set(field, urlEncodeList(value));
    } else {
      var newValuesArr;
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

// eslint-disable-next-line no-unused-vars
var onTagClick = onMultiSelectClick('tags');
// eslint-disable-next-line no-unused-vars
var onStatusClick = onMultiSelectClick('status');

// eslint-disable-next-line no-unused-vars
function onCheckboxClick(value) {
  var url = new URL(window.location);
  if (url.searchParams.has(value)) {
    url.searchParams.delete(value);
  } else {
    url.searchParams.set(value, 'true');
  }
  url.searchParams.delete('page');
  window.location.replace(url);
}

// eslint-disable-next-line no-unused-vars
function onPageChangeClick(pageNumber) {
  var url = new URL(window.location);
  url.searchParams.set('page', pageNumber);
  window.location.replace(url);
}

// eslint-disable-next-line no-unused-vars
function changeSortOrder(order) {
  var url = new URL(window.location);
  if (order === 'reverse') {
    url.searchParams.set('order', 'reverse');
  } else {
    url.searchParams.delete('order');
  }
  url.searchParams.delete('page');
  window.location.replace(url);
}

// eslint-disable-next-line no-unused-vars
function clearFilters() {
  var url = new URL(window.location);
  url.search = '';
  window.location.replace(url);
}
