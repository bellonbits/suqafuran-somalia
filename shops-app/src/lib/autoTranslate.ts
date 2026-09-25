/**
 * autoTranslate
 *
 * Translates the app's interface text into Somali as it renders, without
 * wrapping every string in t(). It watches the DOM and swaps English UI text
 * (text nodes + placeholder/title/aria-label/alt) for its Somali entry in the
 * dictionary, and restores the English originals when the user picks EN.
 *
 * - Exact matches only (after whitespace normalisation), plus a handful of
 *   patterns for dynamic strings like "Showing 1–20 of 60 results". Anything
 *   not in the dictionary is left as-is, so user content passes through.
 * - Anything inside [data-no-translate] (product titles, shop names, chat
 *   messages) is never touched, even if it happens to match a UI phrase.
 * - React may rewrite a node at any time; we detect that (the node no longer
 *   holds what we wrote) and treat the new value as the fresh original.
 */

import { useLanguageStore, type Language } from '@/store/useLanguage';
import { lookupSomali } from './i18n';

type Pattern = [RegExp, (m: RegExpMatchArray) => string];

// Dynamic strings assembled in JSX.
const PATTERNS: Pattern[] = [
    [/^Showing (\d[\d,]*)\s*[–-]\s*(\d[\d,]*) of (\d[\d,]*) results$/, (m) => `Waxaa la muujinayaa ${m[1]}–${m[2]} ee ${m[3]} natiijo`],
    [/^Showing (\d[\d,]*)\s*[–-]\s*(\d[\d,]*) of (\d[\d,]*) shops$/, (m) => `Waxaa la muujinayaa ${m[1]}–${m[2]} ee ${m[3]} dukaan`],
    [/^(\d[\d,]*) products?$/, (m) => `${m[1]} badeecadood`],
    [/^(\d[\d,]*) shops?$/, (m) => `${m[1]} dukaan`],
    [/^(\d[\d,]*) results?$/, (m) => `${m[1]} natiijo`],
    [/^(\d[\d,]*) items?$/, (m) => `${m[1]} shay`],
    [/^(\d[\d,]*) reviews?$/i, (m) => `${m[1]} faallo`],
    [/^(\d[\d,]*) followers?$/i, (m) => `${m[1]} raacayaal`],
    [/^(\d[\d,]*) views?$/i, (m) => `${m[1]} daawasho`],
    [/^Show (\d[\d,]*) results$/, (m) => `Tus ${m[1]} natiijo`],
    [/^Slide (\d+) of (\d+)(.*)$/, (m) => `Sawirka ${m[1]} ee ${m[2]}${m[3]}`],
    [/^(\d+) of (\d+)(:.*)?$/, (m) => `${m[1]} ee ${m[2]}${m[3] ?? ''}`],
    [/^Page (\d+) of (\d+)$/, (m) => `Bogga ${m[1]} ee ${m[2]}`],
    [/^(\d+) (minutes?|mins?) ago$/, (m) => `${m[1]} daqiiqo ka hor`],
    [/^(\d+) (hours?|hrs?) ago$/, (m) => `${m[1]} saac ka hor`],
    [/^(\d+) days? ago$/, (m) => `${m[1]} maalmood ka hor`],
    [/^(\d+) weeks? ago$/, (m) => `${m[1]} toddobaad ka hor`],
    [/^(\d+) months? ago$/, (m) => `${m[1]} bilood ka hor`],
    [/^Just now$/i, () => 'Hadda'],
    [/^(\d(?:\.\d)?) out of (\d) stars$/, (m) => `${m[1]} ka mid ah ${m[2]} xiddigood`],
];

// Trailing decorations kept as-is around a translated phrase ("Condition *", "Price:").
const AFFIX = /^(.*?)(\s*(?:[:*]|\.{3}|…|→|›|×)\s*)$/s;

function somaliFor(text: string): string | null {
    const direct = lookupSomali(text);
    if (direct) return direct;
    // ALL-CAPS labels ("VERIFIED") reuse the normal entry, kept in caps.
    if (/[A-Z]/.test(text) && text === text.toUpperCase()) {
        const lower = text.toLowerCase();
        const cased = lookupSomali(lower.charAt(0).toUpperCase() + lower.slice(1)) ?? lookupSomali(lower.replace(/\b\w/g, (c) => c.toUpperCase()));
        if (cased) return cased.toUpperCase();
    }
    for (const [re, fn] of PATTERNS) {
        const m = text.match(re);
        if (m) return fn(m);
    }
    const a = text.match(AFFIX);
    if (a && a[1]) {
        const inner = lookupSomali(a[1].trim());
        if (inner) return inner + a[2];
    }
    return null;
}

function render(original: string, lang: Language): string | null {
    const lead = original.match(/^\s*/)![0];
    const trail = original.match(/\s*$/)![0];
    const core = original.replace(/\s+/g, ' ').trim();
    if (!core || !/[A-Za-z]/.test(core)) return null;
    const so = somaliFor(core);
    if (!so) return null;
    if (lang === 'bilingual') return so.toLowerCase() === core.toLowerCase() ? null : `${lead}${so} / ${core}${trail}`;
    return `${lead}${so}${trail}`;
}

// ─── Bookkeeping ─────────────────────────────────────────────────────────────
interface Slot { orig: string; written: string | null }
const textSlots = new WeakMap<Text, Slot>();
const attrSlots = new WeakMap<Element, Map<string, Slot>>();
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG']);

let lang: Language = 'so';

function skipped(el: Element | null): boolean {
    for (let e = el; e; e = e.parentElement) {
        if (SKIP_TAGS.has(e.tagName) || e.hasAttribute('data-no-translate') || (e as HTMLElement).isContentEditable) return true;
    }
    return false;
}

function applySlot(slot: Slot, current: string, write: (v: string) => void) {
    // Anything other than what we last wrote means React (or the user) set a new value.
    if (slot.written === null || current !== slot.written) slot.orig = current;
    const target = lang === 'en' ? slot.orig : render(slot.orig, lang) ?? slot.orig;
    if (target !== current) write(target);
    slot.written = target === slot.orig ? null : target;
}

function translateText(node: Text) {
    const current = node.nodeValue ?? '';
    let slot = textSlots.get(node);
    if (!slot) {
        if (lang === 'en' || !/[A-Za-z]/.test(current)) return;
        slot = { orig: current, written: null };
        textSlots.set(node, slot);
    }
    applySlot(slot, current, (v) => { node.nodeValue = v; });
}

function translateAttrs(el: Element) {
    for (const name of ATTRS) {
        const current = el.getAttribute(name);
        if (current === null) continue;
        let slots = attrSlots.get(el);
        let slot = slots?.get(name);
        if (!slot) {
            if (lang === 'en' || !/[A-Za-z]/.test(current)) continue;
            slot = { orig: current, written: null };
            if (!slots) attrSlots.set(el, (slots = new Map()));
            slots.set(name, slot);
        }
        applySlot(slot, current, (v) => el.setAttribute(name, v));
    }
}

function walk(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) {
        if (!skipped((root as Text).parentElement)) translateText(root as Text);
        return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const el = root as Element;
    if (skipped(el)) return;
    translateAttrs(el);
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
            n.nodeType === Node.ELEMENT_NODE && (SKIP_TAGS.has((n as Element).tagName) || (n as Element).hasAttribute('data-no-translate'))
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
        else translateAttrs(n as Element);
    }
}

// ─── Batching ────────────────────────────────────────────────────────────────
const queue = new Set<Node>();
let scheduled = false;
function schedule(node: Node) {
    queue.add(node);
    if (scheduled) return;
    scheduled = true;
    // Microtask: runs before the browser paints, so English never flashes.
    queueMicrotask(() => {
        scheduled = false;
        const nodes = [...queue];
        queue.clear();
        for (const n of nodes) if (n.isConnected) walk(n);
    });
}

let started = false;

export function startAutoTranslate() {
    if (started || typeof document === 'undefined') return;
    started = true;

    const setLang = (next: Language) => {
        lang = next;
        document.documentElement.lang = next === 'en' ? 'en' : 'so';
    };
    setLang(useLanguageStore.getState().language);

    new MutationObserver((records) => {
        for (const r of records) {
            if (r.type === 'childList') r.addedNodes.forEach(schedule);
            else schedule(r.target);
        }
    }).observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ATTRS,
    });

    walk(document.body);

    useLanguageStore.subscribe((state) => {
        if (state.language === lang) return;
        setLang(state.language);
        walk(document.body);
    });
}
