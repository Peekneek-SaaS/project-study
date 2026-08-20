/**
 * The homepage's own design constants.
 *
 * The marketing page is the one surface in this app that is not the app: it
 * runs edge to edge, it inverts to black halfway down, and its type runs at
 * sizes nothing inside the product ever uses. Rather than bend the app's
 * tokens to cover both, the handful of decisions that are *only* the
 * homepage's live here — as class strings, so they stay greppable and a change
 * lands everywhere at once.
 */

/**
 * The page's measure, with the rules that run down either side of it.
 *
 * Every band on the page wears this, which is what makes the two vertical
 * hairlines look continuous from the nav to the footer: they are actually a
 * stack of `border-x`, one per section, meeting at the horizontal rule between
 * them. Borrowed wholesale from the reference — it is the thing that makes the
 * layout read as one drawn grid rather than as a pile of centred blocks.
 */
export const FRAME = "mx-auto w-full max-w-[1280px] border-x border-border";

/**
 * A band that stays dark in both themes.
 *
 * Not `bg-foreground`: that token is near-black in light mode and *white* in
 * dark, so an inverted section built on it would turn into a white slab the
 * moment someone switched themes. These are literal values for the same reason
 * a photograph does not invert — the dark sections are a deliberate change of
 * register in the page's rhythm, not a response to the user's setting.
 */
export const INK = "bg-[oklch(0.16_0.004_106.75)] text-[oklch(0.97_0.002_67.8)]";
export const INK_BORDER = "border-[oklch(1_0_0_/_0.1)]";
export const INK_MUTED = "text-[oklch(1_0_0_/_0.55)]";
export const INK_FAINT = "text-[oklch(1_0_0_/_0.38)]";

/**
 * When a section counts as having been scrolled to.
 *
 * `once` because a page that replays its entrance every time you scroll back
 * up is a page that will not settle. `amount: 0.15` fires when a sixth of the
 * band is showing, which on the tall sections means the movement has finished
 * by the time the section is actually being read — the animation introduces
 * the content, it does not make you wait for it.
 */
export const REVEAL_VIEWPORT = { once: true, amount: 0.15 } as const;

/** The same, for tall visuals that would otherwise never reach 15%. */
export const REVEAL_VIEWPORT_TALL = { once: true, amount: 0.05 } as const;

/** Where the two calls to action go. Clerk owns both routes. */
export const SIGN_UP_PATH = "/sign-up";
export const SIGN_IN_PATH = "/sign-in";
