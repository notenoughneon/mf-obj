var parser = require('microformat-node');
import Request = require('request');
import cheerio = require('cheerio');
import url = require('url');
var debug = require('debug')('mf-obj');

export var request = function(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        Request.get({url, headers: {'User-Agent': 'mf-obj'}}, (err, result) => err !== null ? reject(err) : resolve(result));
    });
}

async function getOembed(html: string) {
    var $ = cheerio.load(html);
    var link = $('link[rel=\'alternate\'][type=\'application/json+oembed\'],' +
        'link[rel=\'alternate\'][type=\'text/json+oembed\']').attr('href');
    if (link == null)
        throw new Error('No oembed link found');
    debug('Fetching ' + link);
    var res = await request(link);
    if (res.statusCode !== 200)
        throw new Error('Server returned status ' + res.statusCode);
    var embed = JSON.parse(res.body);
    return embed;
}

function getOpengraph(html: string) {
    var $ = cheerio.load(html);
    var res = {
        title: $('meta[property=\'og:title\']').attr('content'),
        image: $('meta[property=\'og:image\']').attr('content'),
        url: $('meta[property=\'og:url\']').attr('content'),
        description: $('meta[property=\'og:description\']').attr('content')
    };
    if (res.title == null || res.url == null)
        throw new Error('No opengraph data found');
    return res;
}

export function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;');
}

function getLinks(html) {
    var $ = cheerio.load(html);
    return $('a').toArray().map(a => a.attribs['href']);
}

export type EntryStrategy = 'entry' | 'event' | 'oembed' | 'opengraph' | 'html';

var entryStrategies = {
    'entry' : async function(html, url) {
        var entry = await getEntryFromHtml(html, url);
        if (entry.author !== null && entry.author.url !== null && entry.author.name === null) {
            try {
                var author = await getCard(entry.author.url);
                if (author !== null)
                    entry.author = author;
            } catch (err) {
                debug('Failed to fetch author page: ' + err.message);
            }
        }
        return entry;
    },
    'event' : async function(html, url) {
        var event = await getEventFromHtml(html, url);
        var entry = new Entry(url);
        entry.name = event.name;
        entry.content = {html: escapeHtml(event.name), value: event.name};
        return entry;
    },
    'oembed': async function(html, url) {
        let entry = new Entry(url);
        var oembed = await getOembed(html);
        if (oembed.title != null)
            entry.name = oembed.title;
        if (oembed.html != null) {
            let $ = cheerio.load(oembed.html);
            entry.content = {html: oembed.html, value: $(':root').text()};
        }
        if (oembed.author_url != null && oembed.author_name != null) {
            entry.author = new Card(oembed.author_url);
            entry.author.name = oembed.author_name;
        }
        return entry;
    },
    'opengraph': async function(html, url) {
        let entry = new Entry(url);
        let og = getOpengraph(html);
        if (og.description != null) {
            entry.name = og.title;
            entry.content = {html: escapeHtml(og.description), value: og.description};
        } else {
            entry.content = {html: escapeHtml(og.title), value: og.title};
        }
        return entry;
    },
    'html': async function(html, url) {
        let entry = new Entry(url);
        let $ = cheerio.load(html);
        entry.name = $('title').text();
        entry.content = {html: html, value: $('body').text()};
        return entry;
    }
}

export async function getEntry(url: string, strategies?: EntryStrategy[]): Promise<Entry> {
    if (strategies == null)
        strategies = ['entry'];
    var errs = [];
    debug('Fetching ' + url);
    var res = await request(url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    for (let s of strategies) {
        try {
            return await entryStrategies[s](res.body, url);
        } catch (err) {
            errs.push(err);
        }
    }
    throw new Error('All strategies failed: ' + errs.reduce((p,c) => p + ',' + c.message));
}

export async function getEvent(url: string): Promise<Event> {
    debug('Fetching ' + url);
    var res = await request(url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    return getEventFromHtml(res.body, url);
}

export async function getCard(url: string): Promise<Card> {
    debug('Fetching ' + url);
    var res = await request(url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    var mf = await parser.getAsync({html: res.body, baseUrl: url});
    var cards = mf.items.
        filter(i => i.type.some(t => t == 'h-card')).
        map(h => buildCard(h));
    // 1. uid and url match author-page url
    var match = cards.filter(c =>
        c.url != null &&
        c.uid != null &&
        urlsEqual(c.url, url) &&
        urlsEqual(c.uid, url)
    );
    if (match.length > 0) return match[0];
    // 2. url matches rel=me
    if (mf.rels.me != null) {
        var match = cards.filter(c =>
            mf.rels.me.some(r =>
                c.url != null &&
                urlsEqual(c.url, r)
            )
        );
        if (match.length > 0) return match[0];
    }
    // 3. url matches author-page url
    var match = cards.filter(c =>
        c.url != null &&
        urlsEqual(c.url, url)
    );
    if (match.length > 0) return match[0];
    return null;
}

export async function getFeed(url: string): Promise<Feed> {
    debug('Fetching ' + url);
    var res = await request(url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    return getFeedFromHtml(res.body, url);
}

async function getEntryFromHtml(html: string, url: string): Promise<Entry> {
    var mf = await parser.getAsync({html: html, baseUrl: url});
    var entries = mf.items.filter(i => i.type.some(t => t == 'h-entry'));
    if (entries.length == 0)
        throw new Error('No h-entry found');
    else if (entries.length > 1)
        throw new Error('Multiple h-entries found');
    var relAuthor = mf.rels.author != null && mf.rels.author.length > 0 ? new Card(mf.rels.author[0]) : null;
    let entry = buildEntry(entries[0], relAuthor);
    return entry;
}

async function getEventFromHtml(html: string, url: string): Promise<Event> {
    var mf = await parser.getAsync({html: html, baseUrl: url});
    var events = mf.items.filter(i => i.type.some(t => t === 'h-event'));
    if (events.length == 0)
        throw new Error('No h-event found');
    else if (events.length > 1)
        throw new Error('Multiple h-events found');
    var event = buildEvent(events[0]);
    if (event.url == null)
        event.url = url;
    return event;
}

var feedStrategies = {
    'hfeed': async function(html, url) {
        var mf = await parser.getAsync({html: html, baseUrl: url});
        var feeds = mf.items.filter(i => i.type.some(t => t === 'h-feed'));
        if (feeds.length == 0)
            throw new Error('No h-feed found');
        else if (feeds.length > 1)
            throw new Error('Multiple h-feeds found');
        var feed = await buildFeed(feeds[0]);
        if (feed.url == null)
            feed.url = url;
        if (mf.rels.prev != null && mf.rels.prev.length > 0)
            feed.prev = mf.rels.prev[0];
        else if (mf.rels.previous != null && mf.rels.previous.length > 0)
            feed.prev = mf.rels.previous[0];
        if (mf.rels.next != null && mf.rels.next.length > 0)
            feed.next = mf.rels.next[0];
        return feed;
    },
    'implied': async function(html, url) {
        var mf = await parser.getAsync({html: html, baseUrl: url});
        var entries = mf.items.filter(i => i.type.some(t => t === 'h-entry'));
        if (entries.length == 0)
            throw new Error('No h-entries found');
        var feed = new Feed(url);
        var $ = cheerio.load(html);
        feed.name = $('title').text();
        feed.author = await getCard(url);
        for (let entry of entries) {
            feed.addChild(buildEntry(entry, feed.author));
        }
        if (mf.rels.prev != null && mf.rels.prev.length > 0)
            feed.prev = mf.rels.prev[0];
        else if (mf.rels.previous != null && mf.rels.previous.length > 0)
            feed.prev = mf.rels.previous[0];
        if (mf.rels.next != null && mf.rels.next.length > 0)
            feed.next = mf.rels.next[0];
        return feed;
    }
};

async function getFeedFromHtml(html: string, url: string): Promise<Feed> {
    var strategies = ['hfeed', 'implied'];
    var errs = [];
    for (let s of strategies) {
        try {
            return await feedStrategies[s](html, url);
        } catch (err) {
            errs.push(err);
        }
    }
    throw new Error('All strategies failed: ' + errs.reduce((p,c) => p + ',' + c.message));
}

function prop(mf, name, f?) {
    if (mf.properties[name] != null) {
        if (f != null)
            return mf.properties[name].filter(e => e !== '').map(f);
        return mf.properties[name].filter(e => e !== '');
    }
    return [];
}

function firstProp(mf, name, f?) {
    if (mf.properties[name] != null) {
        if (f != null)
            return f(mf.properties[name][0]);
        return mf.properties[name][0];
    }
    return null;
}

function buildCard(mf) {
    if (typeof(mf) === 'string')
        return new Card(mf);
    var card = new Card();
    if (!mf.type.some(t => t === 'h-card'))
        throw new Error('Attempt to parse ' + mf.type + ' as Card');
    card.name = firstProp(mf, 'name');
    card.photo = firstProp(mf, 'photo');
    card.url = firstProp(mf, 'url');
    card.uid = firstProp(mf, 'uid');
    return card;
}

function buildEvent(mf) {
    if (typeof(mf) === 'string')
        return new Event(mf);
    var event = new Event();
    if (!mf.type.some(t => t === 'h-event'))
        throw new Error('Attempt to parse ' + mf.type + ' as Event');
    event.name = firstProp(mf, 'name');
    event.url = firstProp(mf, 'url');
    event.start = firstProp(mf, 'start', s => new Date(s));
    event.end = firstProp(mf, 'end', e => new Date(e));
    event.location = firstProp(mf, 'location', l => buildCard(l));
    return event;
}

async function buildFeed(mf) {
    if (typeof(mf) === 'string')
        return new Feed(mf);
    var feed = new Feed();
    if (!mf.type.some(t => t === 'h-feed'))
        throw new Error('Attempt to parse ' + mf.type + ' as Feed');
    feed.name = firstProp(mf, 'name');
    feed.url = firstProp(mf, 'url');
    feed.author = firstProp(mf, 'author', a => buildCard(a));
    if (feed.author !== null && feed.author.url !== null && feed.author.name === null) {
        try {
            var author = await getCard(feed.author.url);
            if (author !== null)
                feed.author = author;
        } catch (err) {
            debug('Failed to fetch author page: ' + err.message);
        }
    }
    (mf.children || [])
    .filter(i => i.type.some(t => t === 'h-cite' || t === 'h-entry'))
    .map(e => buildEntry(e, feed.author))
    .filter(e => e.url != null)
    .map(e => feed.addChild(e));
    return feed;
}

function buildEntry(mf, defaultAuthor?: Card) {
    if (typeof(mf) === 'string')
        return new Entry(mf);
    var entry = new Entry();
    if (!mf.type.some(t => t === 'h-entry' || t === 'h-cite'))
        throw new Error('Attempt to parse ' + mf.type + ' as Entry');
    entry.name = firstProp(mf, 'name');
    entry.published = firstProp(mf, 'published', p => new Date(p));
    entry.content = firstProp(mf, 'content');
    entry.summary = firstProp(mf, 'summary');
    entry.url = firstProp(mf, 'url');
    entry.author = firstProp(mf, 'author', a => buildCard(a));
    if (entry.author === null && defaultAuthor)
        entry.author = defaultAuthor;
    entry.category = prop(mf, 'category');
    entry.syndication = prop(mf, 'syndication');
    entry.syndicateTo = prop(mf, 'syndicate-to');
    entry.photo = prop(mf, 'photo');
    entry.audio = prop(mf, 'audio');
    entry.video = prop(mf, 'video');
    entry.replyTo = prop(mf, 'in-reply-to', r => buildEntry(r));
    entry.likeOf = prop(mf, 'like-of', r => buildEntry(r));
    entry.repostOf = prop(mf, 'repost-of', r => buildEntry(r));
    entry.embed = firstProp(mf, 'x-embed');
    (mf.children || [])
    .concat(mf.properties['comment'] || [])
    .filter(i => i.type.some(t => t === 'h-cite' || t === 'h-entry'))
    .map(e => buildEntry(e))
    .filter(e => e.url != null)
    .map(e => entry.addChild(e));
    return entry;
}

function urlsEqual(u1, u2) {
    var p1 = url.parse(u1);
    var p2 = url.parse(u2);
    return p1.protocol === p2.protocol &&
        p1.host === p2.host &&
        p1.path === p2.path;
}

export class Entry {
    name: string = null;
    published: Date = null;
    content: {value: string, html: string} = null;
    summary: string = null;
    url: string = null;
    author: Card = null;
    category: string[] = [];
    syndication: string[] = [];
    syndicateTo: string[] = [];
    photo: string[] = [];
    audio: string[] = [];
    video: string[] = [];
    replyTo: Entry[] = [];
    likeOf: Entry[] = [];
    repostOf: Entry[] = [];
    embed: {value: string, html: string} = null;
    private children: Map<string, Entry> = new Map();

    constructor(url?: string) {
        if (typeof(url) === 'string') {
            this.url = url;
        }
    }
    
    private _getTime() {
        if (this.published != null)
            return this.published.getTime();
        return -1;
    }

    private _getType(): number {
        if (this.isLike() || this.isRepost())
            return 1;
        return 0;
    }

    static byDate = (a: Entry, b: Entry) => a._getTime() - b._getTime();
    static byDateDesc = (a: Entry, b: Entry) => b._getTime() - a._getTime();
    static byType = (a: Entry, b: Entry) => a._getType() - b._getType();
    static byTypeDesc = (a: Entry, b: Entry) => b._getType() - a._getType();

    getDomain(): string {
        var p = url.parse(this.url);
        return p.protocol + '//' + p.host;
    }
    
    getPath(): string {
        return url.parse(this.url).path;
    }

    getReferences(): string[] {
        return this.replyTo.concat(this.likeOf).concat(this.repostOf).map(r => r.url);
    }

    getMentions(): string[] {
        var allLinks = this.getReferences();
        if (this.content != null)
            allLinks = allLinks.concat(getLinks(this.content.html));
        return allLinks;
    }
    
    getChildren(sortFunc?: (a: Entry, b: Entry) => number) {
        var values = Array.from(this.children.values());
        if (sortFunc != null)
            values.sort(sortFunc);
        return values;
    }
    
    addChild(entry: Entry) {
        if (entry.url == null)
            throw new Error('Url must be set');
        this.children.set(entry.url, entry);
    }
    
    deleteChild(url: string) {
        return this.children.delete(url);
    }

    isReply(): boolean {
        return this.replyTo.length > 0;
    }

    isRepost(): boolean {
        return this.repostOf.length > 0;
    }

    isLike(): boolean {
        return this.likeOf.length > 0;
    }

    isArticle(): boolean {
        return !this.isReply() &&
            !this.isRepost() &&
            !this.isLike() &&
            this.name != null &&
            this.content != null &&
            this.content.value != '' &&
            this.name !== this.content.value;
    }

    serialize(): string {
        return JSON.stringify(this, (key,val) => {
            if (key === 'replyTo' || key === 'repostOf' || key === 'likeOf')
                return val.map(e => e.url);
            if (key === 'children')
                return Array.from(val.values()).map(r => r.url);
            return val;
        });
    }

    static deserialize(json: string): Entry {
        return JSON.parse(json, (key,val) => {
            if (val != null && key === 'author') {
                var author = new Card();
                author.name = val.name;
                author.photo = val.photo;
                author.uid = val.uid;
                author.url = val.url;
                return author;
            }
            if (key === 'replyTo' || key === 'repostOf' || key === 'likeOf')
                return val.map(e => new Entry(e));
            if (key === 'children')
                return new Map(val.map(url => [url, new Entry(url)]));
            if (key === '') {
                var entry = new Entry();
                entry.name = val.name;
                entry.published = val.published ? new Date(val.published) : null;
                entry.content = val.content;
                entry.summary = val.summary;
                entry.url = val.url;
                entry.author = val.author;
                entry.category = val.category;
                entry.syndication = val.syndication;
                entry.syndicateTo = val.syndicateTo;
                entry.replyTo = val.replyTo;
                entry.likeOf = val.likeOf;
                entry.repostOf = val.repostOf;
                entry.embed = val.embed;
                entry.children = val.children;
                return entry;
            }
            return val;
        });
    }
}

export class Card {
    name: string = null;
    photo: string = null;
    url: string = null;
    uid: string = null;

    constructor(urlOrName?: string) {
        if (typeof(urlOrName) === 'string') {
            if (urlOrName.startsWith('http://') || urlOrName.startsWith('https://'))
                this.url = urlOrName;
            else
                this.name = urlOrName;
        }
    }
}

export class Event {
    name: string = null;
    url: string = null;
    start: Date = null;
    end: Date = null;
    location: Card = null;

    constructor(url?: string) {
        if (typeof(url) === 'string') {
            this.url = url;
        }
    }
}

export class Feed {
    name: string = null;
    url: string = null;
    author: Card = null;
    prev: string = null;
    next: string = null;
    private children: Map<string, Entry> = new Map();

    constructor(url?: string) {
        if (typeof(url) === 'string') {
            this.url = url;
        }
    }
    
    getChildren(sortFunc?: (a: Entry, b: Entry) => number) {
        var values = Array.from(this.children.values());
        if (sortFunc != null)
            values.sort(sortFunc);
        return values;
    }
    
    addChild(entry: Entry) {
        if (entry.url == null)
            throw new Error('Url must be set');
        this.children.set(entry.url, entry);
    }
    
    deleteChild(url: string) {
        return this.children.delete(url);
    }
}