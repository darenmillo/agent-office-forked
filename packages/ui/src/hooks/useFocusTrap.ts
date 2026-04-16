/** Minimal focus-trap hook — used by Raijin modals to keep Tab keys inside
 * the dialog and restore focus to the opener on close. Ships ~60 LOC without
 * pulling in focus-trap / focus-lock dependencies.
 *
 * Usage:
 *   const ref = useFocusTrap<HTMLDivElement>(open);
 *   <div ref={ref} role="dialog" aria-modal="true">…</div>
 *
 * The hook:
 *  - Saves document.activeElement when `active` flips true
 *  - Moves focus into the first focusable descendant on mount
 *  - Cycles Tab / Shift+Tab within the container
 *  - Restores focus to the original element when `active` flips false
 */
import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
    const containerRef = useRef<T | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!active) return;

        // Remember who opened the modal so we can restore focus on close.
        previousFocusRef.current = document.activeElement as HTMLElement | null;

        const container = containerRef.current;
        if (!container) return;

        // Move focus to the first focusable element inside the modal.
        const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const focusables = Array.from(
                container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }

            const firstEl = focusables[0];
            const lastEl = focusables[focusables.length - 1];
            const activeEl = document.activeElement as HTMLElement | null;

            if (e.shiftKey) {
                if (activeEl === firstEl || !container.contains(activeEl)) {
                    e.preventDefault();
                    lastEl.focus();
                }
            } else {
                if (activeEl === lastEl || !container.contains(activeEl)) {
                    e.preventDefault();
                    firstEl.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Restore focus on close
            previousFocusRef.current?.focus?.();
        };
    }, [active]);

    return containerRef;
}
