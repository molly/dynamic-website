(function () {
  document.getElementById('filters').addEventListener('submit', function (e) {
    e.preventDefault();
    var query = document.getElementById('search-input').value;
    var url = new URL(window.location);
    if (url.searchParams.has('search') && !query) {
      url.searchParams.delete('search');
      window.location = url;
    } else if (query) {
      url.searchParams.set('search', query);
      window.location.replace(url);
    }
  });
})();

function getTagsListFromUrl(url = null) {
  if (!url) {
    url = new URL(window.location);
  }
  var urlParam = url.searchParams.get('tags');
  if (urlParam) {
    return decodeURIComponent(urlParam).split('-');
  }
  return [];
}

function urlEncodeTags(tags) {
  var tagsStr = Array.isArray(tags) ? tags.join('-') : tags;
  return encodeURIComponent(tagsStr.replace(' ', '_'));
}

// eslint-disable-next-line no-unused-vars
function onTagClick(tag) {
  // Set URL param
  var url = new URL(window.location);
  var tags = getTagsListFromUrl(url);
  if (!tags.length) {
    url.searchParams.set('tags', urlEncodeTags(tag));
  } else {
    var newTagsArr;
    if (tags.includes(tag)) {
      newTagsArr = tags.filter(function (t) {
        return t !== tag;
      });
    } else {
      newTagsArr = tags.slice();
      newTagsArr.push(tag);
    }
    const newTagString = urlEncodeTags(newTagsArr);
    if (newTagString == '') {
      url.searchParams.delete('tags');
    } else {
      url.searchParams.set('tags', newTagString);
    }
  }
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
  window.location.replace(url);
}
