/* The page's long work, and the stripe that says it is going on.
 *
 * A switch on a file's box changes a class on every node of that file's column, and a folder or a category is that same
 * work over every file below it. That alone is cheap — measured at about 2 µs a node, so a whole category of this
 * repository's report (73 columns, 55 042 nodes) is 120 ms of it — but it is not the price. **The browser lays this
 * table out again for any change of a column's visibility, and that is close to a second on a table of a few hundred
 * thousand cells** (`probes/step-12-columns.mjs`: 1 cell toggled 234 ms of layout, 750 cells 287 ms, 6 000 cells
 * 539 ms, and the whole click on the shipped page 867 ms blocked with a 742 ms task).
 *
 * Hence the shape of this chapter, and it is a decision rather than a default. The drawing of a switch is **one task**:
 * what is queued is drawn in a single go, one layout, one repaint. Slicing it — a queue worked off between timeouts —
 * was written first and measured (Chrome 153, this repository's report): 37 slices of two columns each paid the table's
 * relayout 37 times, 2.5–4 s a slice, 95 frames and 169 layouts of 151.9 s of pure layout time against 1.04 s for the
 * same click when it is not sliced, with the tab growing to several gigabytes of repaint. The slice is the thing that
 * freezes the page, only more often, so there is none.
 *
 * What is left is honesty about it: work short enough to be over before the browser could paint a stripe is done on the
 * click itself, and above that the stripe appears, the drawing happens in the next task, and the stripe goes away —
 * so a reader sees that the page is working rather than wondering whether it hung. The stripe carries no share: within
 * one task the browser cannot repaint, so a bar that filled would be a bar that lies, and the page already knows the
 * one thing that is true about it (the work is going on).
 */

/* Above this much node work the drawing is one task with a stripe rather than a task on the click: a stripe that
 * appears and disappears within the same frame is worse than none, and the figure is one file's column of a report of
 * this repository's size (754 nodes). */
export const APP_LONG = 2000;

/* The stripe: on while a switch is being drawn, off when it is done. There is nothing to count here, and the length is
 * carried by the styling (an indeterminate stripe), which is why this function takes a switch rather than a share. */
export function appBar(shown) {
  const bar = document.getElementById('bar');
  if (bar !== null) bar.hidden = !shown;
}

/* What a switch asks for: `items` are the columns that have to be drawn (`{i, units}` — the file's index and the nodes
 * of its column), `step` draws one of them from the view, and the total decides whether the drawing is the reader's own
 * click or the next task with the stripe over it. Only the columns out of step with the view are asked for at all
 * (`appColumnStale`), so a report opened with everything switched on has nothing to draw here. */
export function appDraw(step, items) {
  /* Counted by a plain walk rather than by `reduce`: the page's shell is held to a rule that it counts no totals of the
   * table itself, and a guard that has to tell a sum of nodes from a sum of numbers is a guard that will be argued with
   * one day. The count of nodes is not one of the report's numbers. */
  let units = 0;
  items.forEach((item) => { units += item.units; });
  if (units <= APP_LONG) {
    items.forEach((item) => step(item.i));
    return;
  }
  appBar(true);
  setTimeout(() => {
    items.forEach((item) => step(item.i));
    appBar(false);
  }, 0);
}
