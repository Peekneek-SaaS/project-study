"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * How a conversation scrolls while it is being answered.
 *
 * The behaviour wanted is one rule with two visible halves: the question you
 * just asked goes to the top of the screen, and the answer then fills the space
 * below it — following along on its own once the answer is longer than the
 * screen, and letting go the moment you scroll away.
 *
 * Those look like two competing rules, and trying to express them as two is
 * what makes chat scrolling hard: "pin the question at the top" and "stay at
 * the bottom" cannot both be obeyed. They collapse into one rule with a
 * *spacer*: a stretch of empty room after the last turn, sized so that the
 * turn — however short — is tall enough to fill the viewport on its own.
 *
 * With that in place there is only ever one instruction, "stay at the bottom":
 *
 *   - A short answer cannot push the question off the top, because the spacer
 *     is holding the remaining height. The question sits at the top and the
 *     answer grows underneath it.
 *   - A long answer needs no spacer, so it is zero, and staying at the bottom
 *     means following the text as it streams.
 *
 * The handover between the two is continuous, because the spacer shrinks by
 * exactly as much as the answer grows.
 *
 * Written here rather than driven through the scroller component because that
 * component offers these as *modes*: one that anchors a message and never
 * follows, and one that follows and never anchors. This needs both at once.
 */

/** Breathing room above the question once it reaches the top, in px. */
const TOP_MARGIN = 28;

/**
 * How far from the bottom still counts as "at the bottom", in px.
 *
 * Generous, because it has two jobs: absorbing the sub-pixel rounding that
 * makes `scrollTop + clientHeight` miss `scrollHeight` by a fraction, and
 * treating a small nudge of the wheel as reading rather than as leaving.
 */
const BOTTOM_THRESHOLD = 64;

export interface ChatScrollHandles {
  /** The element that scrolls. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Wraps the messages, and nothing else — the spacer must sit outside it. */
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** The empty stretch after the last turn. Height is set imperatively. */
  spacerRef: React.RefObject<HTMLDivElement | null>;
  /** Marks the message the spacer is measured from — the newest question. */
  anchorRef: React.RefObject<HTMLDivElement | null>;
  /** True while the view is following the newest content. */
  isFollowingRef: React.RefObject<boolean>;
  /**
   * Whether the reader has left the bottom — the cue to offer a way back.
   *
   * State as well as the ref above, because a button has to re-render to
   * appear and the follow logic must not re-render at all. Written only when
   * the answer flips, so a scroll is still one render rather than one per
   * frame.
   */
  isAway: boolean;
  /** Jumps to the newest content and resumes following. */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export function useChatScroll({
  /** Changes whenever a new question is sent — the cue to re-anchor. */
  turnKey,
  /** Grows on every token, which is what drives the follow. */
  revision,
}: {
  turnKey: string | undefined;
  revision: number;
}): ChatScrollHandles {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Whether the newest content should stay in view. Turned off by scrolling
  // away and back on by returning to the bottom — never by anything else, so a
  // long answer cannot drag the reader back down.
  const isFollowingRef = useRef(true);
  const [isAway, setIsAway] = useState(false);

  /**
   * Whether a question has been asked *on this page*.
   *
   * The spacer exists to carry a newly asked question to the top of the screen.
   * Opening a conversation that was had earlier is not that: nothing was just
   * asked, and reserving the room anyway lands the reader on the last question
   * pinned to the top with the end of its answer below and blank space beneath
   * that — which reads as a transcript that failed to scroll.
   *
   * So anchoring stays off until the question actually changes, and an opened
   * conversation simply lands at the end of the last answer.
   */
  const isAnchoringRef = useRef(false);

  /** The question the last anchor was measured from, to spot a real send. */
  const seenTurnRef = useRef<string | undefined>(undefined);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    isFollowingRef.current = true;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }, []);

  /**
   * Sizes the spacer so the newest question can reach the top of the screen.
   *
   * The measurement is "how much of the viewport would be left empty if the
   * question sat at the top" — viewport height, less everything from the
   * question down to the end of the transcript. Once the answer is long enough
   * to fill that on its own the result goes negative and the spacer disappears,
   * which is what turns anchoring into following without a second rule.
   */
  const resize = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    const spacer = spacerRef.current;
    const anchor = anchorRef.current;
    if (!viewport || !content || !spacer) return;

    // No anchor to measure from, or nothing has been asked yet on this page —
    // either way there is no room to reserve.
    if (!anchor || !isAnchoringRef.current) {
      spacer.style.height = "0px";
      return;
    }

    const turnHeight =
      content.getBoundingClientRect().bottom -
      anchor.getBoundingClientRect().top;

    const room = viewport.clientHeight - turnHeight - TOP_MARGIN;
    spacer.style.height = `${Math.max(0, room)}px`;
  }, []);

  /**
   * A new question was asked.
   *
   * The spacer is sized before the scroll rather than after, so the room the
   * question needs to reach the top already exists when the scroll runs —
   * otherwise it lands short and then jumps as the spacer appears underneath.
   *
   * `useLayoutEffect` for the same reason: both happen before the browser
   * paints, so the question is never seen at the wrong height first.
   */
  useLayoutEffect(() => {
    if (!turnKey || turnKey === seenTurnRef.current) return;

    const isArriving = seenTurnRef.current === undefined;
    seenTurnRef.current = turnKey;

    if (isArriving) {
      // Landing on a conversation that already existed. No anchoring — see
      // `isAnchoringRef` — so this is simply "show me the end of it", and
      // instant rather than smooth because there is nothing to animate *from*.
      isAnchoringRef.current = false;
      resize();
      scrollToBottom("auto");
      return;
    }

    isAnchoringRef.current = true;
    resize();
    // Smooth here and nowhere else. This is the one scroll the user asked for
    // by pressing send, so it is worth showing; the ones that follow a stream
    // are continuous and would fight each other animated.
    scrollToBottom("smooth");
  }, [turnKey, resize, scrollToBottom]);

  /**
   * The answer grew.
   *
   * Re-measured every time because the spacer shrinks as the answer fills it,
   * and followed only while the reader has not gone elsewhere.
   */
  useLayoutEffect(() => {
    resize();
    if (isFollowingRef.current) scrollToBottom("auto");
  }, [revision, resize, scrollToBottom]);

  /**
   * Content that changes size without changing the message list — a markdown
   * table finishing its layout, a formula being typeset, an image arriving.
   *
   * Without this the spacer keeps a stale measurement and the follow stops one
   * paint short of the real bottom.
   */
  useEffect(() => {
    const content = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      resize();
      if (isFollowingRef.current) scrollToBottom("auto");
    });

    observer.observe(content);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [resize, scrollToBottom]);

  /**
   * Whether to keep following, decided by where the reader is.
   *
   * Position rather than intent: there is no need to tell a wheel from a
   * trackpad from a keyboard, because all of them are only interesting when
   * they leave the bottom. It also means a programmatic scroll cannot switch
   * following off by accident — it lands *at* the bottom, which reads as
   * staying.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const distance =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const following = distance <= BOTTOM_THRESHOLD;

      isFollowingRef.current = following;
      // Only on a change of answer. Scroll fires continuously, and setting the
      // same value on every frame would re-render the whole transcript for the
      // length of a scroll.
      setIsAway((current) => (current === !following ? current : !following));
    };

    // Run once on mount so the button's state is right before the first
    // scroll — a conversation that opens shorter than its viewport never
    // scrolls at all, and would otherwise keep whatever it started with.
    handleScroll();

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  return {
    viewportRef,
    contentRef,
    spacerRef,
    anchorRef,
    isFollowingRef,
    isAway,
    scrollToBottom,
  };
}
