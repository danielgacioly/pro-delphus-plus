import type { SVGProps } from 'react'

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

export function IconQuote(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M7 3h10a2 2 0 0 1 2 2v13l-4-3H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 8h8M8 12h5" />
    </Base>
  )
}

export function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 11.5 12.5 2H19a2 2 0 0 1 2 2v6.5L11.5 21 3 12.5v-1Z" />
      <circle cx="15.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  )
}

export function IconBox(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 8.5 12 4l9 4.5M3 8.5v7L12 20l9-4.5v-7M3 8.5 12 13l9-4.5M12 13v7" />
    </Base>
  )
}

export function IconTruck(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </Base>
  )
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.5c1.7.4 3 2 3 3.7s-1.3 3.3-3 3.7" />
      <path d="M21 20c0-2.8-1.9-5.1-4.5-5.8" />
    </Base>
  )
}

export function IconLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="m12 3 9 4.5-9 4.5-9-4.5Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </Base>
  )
}

export function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
      <path d="M3 20h18" />
    </Base>
  )
}

export function IconBoard(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 8v9M13 8v5M18 8v11" />
    </Base>
  )
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </Base>
  )
}

export function IconInbox(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 12h4.5l1.5 3h6l1.5-3H21" />
      <path d="M5.5 5.5h13L21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6L5.5 5.5Z" />
    </Base>
  )
}

export function IconAlert(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17.2" r="0.15" fill="currentColor" />
    </Base>
  )
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  )
}

export function IconSliders(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h13M21 18h-2" />
      <circle cx="15" cy="6" r="2" fill="white" />
      <circle cx="7" cy="12" r="2" fill="white" />
      <circle cx="19" cy="18" r="2" fill="white" />
    </Base>
  )
}
