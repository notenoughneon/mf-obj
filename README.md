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

### Get entry from url
```javascript
mfo.getEntry('http://somesite/2016/5/1/1')
.then(entry => {
    if (entry.isReply() {
        console.log('I\'m a reply to "' + entry.replyTo.name + '"');
    }
});
```

## API

1. [Utility functions](#utility-functions)
  * [getEntry(url, strategies?)](#getentry)
  * [getCard(url)](#getcard)
  * [getEvent(url)](#getevent)
  * [getFeed(url)](#getfeed)
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
5. [Feed](#feed)
  * [name](#name-3)
  * [url](#url-2)
  * [author](#author-2)
  * [prev](#prev)
  * [next](#next)
  * [getChildren(sortFunc?)](#getchildren-2)
  * [addChild(entry)](#addchild-2)
  * [deleteChild(url)](#deletechild-2)

  
### Utility functions

#### getEntryFromUrl()

```javascript
mfo.getEntry(url)
.then(entry => {
  //...
});
```

```javascript
mfo.getEntry(url, ['entry','event','oembed'])
.then(entry => {
    //...
});
```

Fetches the page at `url` and returns a *Promise* for an [Entry](#entry). This will perform the authorship algorithm and fetch the author h-card from a separate url if necessary.

The second parameter `strategies` is an optional array of strategies to attempt to marshal to an Entry. Strategies are tried in order and if all fail, an exception is thrown. This can be used for displaying comments or reply contexts of URLs that don't contain h-entries. The default value for this parameter is `['entry']`.

* `entry` - Default h-entry strategy.
* `event` - Marshall an h-event to an Entry. Useful for creating RSVP reply-contexts to an h-event.
* `oembed` - Marshall oembed data to an Entry. Useful for creating reply-contexts or reposts of silo content.
* `opengraph` - Marshall opengraph data to an Entry. Useful for creating reply-contexts or reposts of silo content.
* `html` - Most basic strategy. Marshalls html `<title>` to name and `<body>` to content.

#### getCard()

```javascript
mfo.getCard(url)
.then(card => {
  //...
});
```
Fetches the page at url and returns a *Promise* for a [Card](#card). This will return null if an h-card could not be found according to the authorship algorithm.

#### getEvent()

```javascript
mfo.getEvent(url)
.then(event => {
  //...
});
```
Fetches the page at url and returns a *Promise* for an [Event](#event).

#### getFeed()

```javascript
mfo.getFeed(url)
.then(feed => {
  //...
});
```
Fetches the page at url and returns a *Promise* for a [Feed](#feed).

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

See [Card](#card).

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

Entry[] || null

#### likeOf

Parsed from like-of.

Entry[] || null

#### repostOf

Parsed from repost-of.

Entry[] || null

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

Tests if reply-to is non-empty.

#### isLike()

Tests if like-of is non-empty.

#### isRepost()

Tests if repost-of is non-empty.

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
  "replyTo":["http://testsite/2015/8/28/2"],
  "likeOf":[],
  "repostOf":[],
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

### Feed

Represents an h-feed. Properties of this object correspond to output from the mf2 parser, but have been converted from arrays of string to other datatypes for convenience.

```javascript
var event = new mfo.Feed();
var event = new mfo.Feed('http://somesite');
```
The constructor takes an optional argument to set the url.

#### name

string || null

#### url

string || null

#### author

Card || null

See [Card](#card).

#### prev

Parsed from rel="prev" or rel="previous".

string || null

#### next

Parsed from rel="next".

string || null

#### getChildren()

Returns an array of Entries. Use this instead of directly accessing the children property. Takes an optional argument to sort the results.

#### addChild()

Adds an Entry to the list of children. If there is an existing child with the same url, it will be overwritten.

#### deleteChild()

Remove an entry from the list of children by url.
