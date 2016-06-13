# mf-obj
[![npm](https://img.shields.io/npm/v/mf-obj.svg?maxAge=2592000?style=plastic)](https://www.npmjs.com/package/mf-obj)
[![Build Status](https://travis-ci.org/notenoughneon/mf-obj.svg?branch=master)](https://travis-ci.org/notenoughneon/mf-obj)
[![Coverage Status](https://coveralls.io/repos/github/notenoughneon/mf-obj/badge.svg?branch=master)](https://coveralls.io/github/notenoughneon/mf-obj?branch=master)

Microformat objects are a set of utility classes for working with indieweb [posts](http://indiewebcamp.com/posts).
* Read different kinds of posts:
  * notes
  * articles
  * replies
  * likes
  * reposts
* Parse comments and reply contexts as nested objects
* Resolve author with the [authorship algorithm](http://indiewebcamp.com/authorship)
* Get a list of [webmention](http://indiewebcamp.com/Webmention) targets
* Serialize and deserialize from JSON

## Installation

Microformat objects makes use of ES6 features and requires Node >= 4.0.0.

```
npm install mf-obj --save
```

## Examples

### Parse entry from html
```javascript
var mfo = require('mf-obj');

var html = '<div class="h-entry">\
<div class="p-name">Hello world!</div>\
</div>';

mfo.getEntry(html, 'http://somesite/2016/5/1/1')
.then(entry => console.log(entry.name));
```

### Fetch entry from url
```javascript
mfo.getEntryFromUrl('http://somesite/2016/5/1/1')
.then(entry => {
    if (entry.isReply() {
        console.log('I\'m a reply to "' + entry.replyTo.name + '"');
    }
});
```

## API

1. [Utility functions](#utility-functions)
  * [getEntry(html, url)](#getentry)
  * [getEntryFromUrl(url)](#getentryfromurl)
  * [getCardFromUrl(url)](#getcardfromurl)
  * [getEvent(html, url)](#getevent)
  * [getEventFromUrl(url)](#geteventfromurl)
  * [getThreadFromUrl(url)](#getthreadfromurl)
2. [Entry](#entry)
  * [name](#name)
  * [published](#published)
  * [content](#content)
  * [summary](#summary)
  * [url](#url)
  * [author](#author)
  * [category](#category)
  * [syndication](#syndication)
  * [syndicateTo](#syndicateto)
  * [photo](#photo)
  * [audio](#audio)
  * [video](#video)
  * [replyTo](#replyto)
  * [likeOf](#likeof)
  * [repostOf](#repostof)
  * [embed](#embed)
  * [getDomain()](#getdomain)
  * [getPath()](#getpath)
  * [getReferences()](#getreferences)
  * [getMentions()](#getmentions)
  * [getChildren(sortFunc?)](#getchildren)
  * [addChild(entry)](#addchild)
  * [deleteChild(url)](#deletechild)
  * [isReply()](#isreply)
  * [isLike()](#islike)
  * [isRepost()](#isrepost)
  * [isArticle()](#isarticle)
  * [serialize()](#serialize)
  * [deserialize(json)](#deserialize)
3. [Card](#card)
  * [name](#name-1)
  * [photo](#photo)
  * [url](#url-1)
  * [uid](#uid)
4. [Event](#event)
  * [name](#name-2)
  * [url](#url-1)
  * [start](#start)
  * [end](#end)
  * [location](#location)
  
### Utility functions

#### getEntry()

```javascript
mfo.getEntry(html, url)
.then(entry => {
  //...
});
```
Parses html for a single h-entry and returns a *Promise* for an Entry. Throws an exception if it does not find one and only one top-level h-entry.

#### getEntryFromUrl()

```javascript
mfo.getEntryFromUrl(url)
.then(entry => {
  //...
});
```
Fetches the page at url and returns a *Promise* for an Entry. This will perform the authorship algorithm and fetch the author h-card from a separate url if necessary. If a single h-event is found instead of an h-entry, it will be marshalled into an Entry for displaying a reply-context.

#### getCardFromUrl()

```javascript
mfo.getCardFromUrl(url)
.then(card => {
  //...
});
```
Fetches the page at url and returns a *Promise* for a Card. This will return null if an h-card could not be found according to the authorship algorithm.

#### getEvent()

```javascript
mfo.getEvent(html, url)
.then(event => {
  //...
});
```
Parses html for a single h-event and returns a *Promise* for an Event. Throws an exception if it does not find one and only one top-level h-event.

#### getEventFromUrl()

```javascript
mfo.getEventFromUrl(url)
.then(event => {
  //...
});
```
Fetches the page at url and returns a *Promise* for an Event.

#### getThreadFromUrl()
```javascript
mfo.getThreadFromUrl(url)
.then(thread => {
  for (let entry of thread) {
    // ...
  }
});
```
Follows the chain of replies starting at url and returns a *Promise* for an array of Entry objects. This uses breadth-first search to traverse the graph of posts found by following the urls in reply-to, like-of, repost-of, and children.

### Entry

Represents an h-entry or h-cite. Properties of this object correspond to output from the mf2 parser, but have been converted from arrays of string to other data types for convenience.

```javascript
var entry = new mfo.Entry();
var entry2 = new mfo.Entry('http://somesite/2016/5/2/1');
```
The constructor takes an optional argument to set the url.

#### name

string || null

#### published

Date || null

#### content

{html: string, value: string} || null

#### summary

string || null

#### url

string || null

#### author

Card || null

See [Card](#card) below.

#### category

string[]

#### syndication

string[]

#### syndicateTo

Parsed from syndicate-to.

string[]

#### photo

string[]

#### audio

string[]

#### video

string[]

#### replyTo

Parsed from in-reply-to.

Entry || null

#### likeOf

Parsed from like-of.

Entry || null

#### repostOf

Parsed from repost-of.

Entry || null

#### embed

{html: string, value: string} || null

Experimental property for storing oembed content. Parsed from e-x-embed.

#### getDomain()

Returns the domain component of the url.

#### getPath()

Returns the path component of the url.

#### getReferences()

Returns an array of urls from the reply-to, like-of, or repost-of properties.

#### getMentions()

Returns an array of urls found in links in the e-content, in addition to getReferences(). Intended for sending webmentions.

#### getChildren()

Returns an array of Entries. Use this instead of directly accessing the children property. Takes an optional argument to sort the results.

```javascript
var unsorted = entry.getChildren();
var sorted = entry.getChildren(mfo.Entry.byDate);
```

#### addChild()

Adds an Entry to the list of children. If there is an existing child with the same url, it will be overwritten.

```javascript
function receiveWebmention(sourceUrl, targetUrl) {
  // ...
  var sourceEntry = mfo.getEntryFromUrl(sourceUrl);
  targetEntry.addChild(sourceEntry);
  // ...
}
```

#### deleteChild()

Remove an entry from the list of children by url.

```javascript
function receiveWebmention(sourceUrl, targetUrl) {
  // ...
  if (got404) {
    targetEntry.deleteChild(sourceUrl);
  }
  // ...
}
```

#### isReply()

Tests if reply-to is set.

#### isLike()

Tests if like-of is set.

#### isRepost()

Tests if repost-of is set.

#### isArticle()

Tests if name and content.value properties exist and differ, in addition to other heuristics.

#### serialize()

Serialize object to JSON. Nested Entry objects in replyTo, likeOf, repostOf, and children are serialized as an url string.

Example output:
```json
{
  "name":"Hello World!",
  "published":"2015-08-28T08:00:00.000Z",
  "content":{
    "value":"Hello World!",
    "html":"Hello <b>World!</b>"
  },
  "summary":"Summary",
  "url":"http://testsite/2015/8/28/2",
  "author":{
    "name":"Test User",
    "photo":null,
    "url":"http://testsite",
    "uid":null
    },
  "category":["indieweb"],
  "syndication":[],
  "syndicateTo":[],
  "photo":[],
  "audio":[],
  "video":[],
  "replyTo":"http://testsite/2015/8/28/2",
  "likeOf":null,
  "repostOf":null,
  "embed":null,
  "children":["http://testsite/2015/8/28/3"]
}
```

#### deserialize

Static method to deserialize json. Nested objects from replyTo, likeOf, repostOf, and children are deserialized as stub Entry objects with only url set.

```javascript
var entry = mfo.Entry.deserialize(json);
```

### Card

Represents an h-card. Properties of this object correspond to output from the mf2 parser, but have been converted from arrays of string to string for convenience.

```javascript
var author = new mfo.Card();
var author = new mfo.Card('http://somesite');
```
The constructor takes an optional argument to set the url.

#### name

string || null

#### photo

string || null

#### url

string || null

#### uid

string || null

### Event

Represents an h-event. Properties of this object correspond to output from the mf2 parser, but have been converted from arrays of string to other datatypes for convenience.

```javascript
var event = new mfo.Event();
var event = new mfo.Event('http://somesite/event');
```
The constructor takes an optional argument to set the url.

#### name

string || null

#### url

string || null

#### start

Date || null

#### stop

Date || null

#### Location

Card || null