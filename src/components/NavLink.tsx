"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ComponentProps } from "react";
import { createPortal } from "react-dom";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/** Prefetch tujuan dan beri respons klik selama navigasi server berlangsung. */
export function NavLink({ href, children, onClick, className, replace, scroll, ...props }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Link
        {...props}
        href={href}
        prefetch={props.prefetch ?? true}
        replace={replace}
        scroll={scroll}
        className={className}
        aria-busy={pending || undefined}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (event.currentTarget.target && event.currentTarget.target !== "_self") || props.download) return;
          // Anchor pada halaman yang sama tetap ditangani Link untuk scrolling.
          const destination = new URL(href, window.location.href);
          if (destination.origin !== window.location.origin || (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
          event.preventDefault();
          startTransition(() => {
            if (replace) router.replace(href, { scroll });
            else router.push(href, { scroll });
          });
        }}
      >
        {children}
      </Link>
      {pending && createPortal(
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <span className="glass-bar flex items-center gap-2 rounded-full border border-primary/30 px-5 py-3 text-xs font-medium text-primary shadow-xl">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Membuka halaman…
          </span>
        </div>,
        document.body,
      )}
    </>
  );
}
