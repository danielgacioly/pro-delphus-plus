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

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z" />
    </Base>
  )
}

export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </Base>
  )
}

export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </Base>
  )
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  )
}

export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="m9 6 6 6-6 6" />
    </Base>
  )
}

export function IconSidebar(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9.5 4v16" />
    </Base>
  )
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7" />
    </Base>
  )
}

export function IconContacts(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 17c.6-1.8 2.1-3 4-3s3.4 1.2 4 3" />
    </Base>
  )
}

export function IconBuilding(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 20V6.5a2 2 0 0 1 1.4-1.9l6-1.9a1 1 0 0 1 1.3 1V20" />
      <path d="M12.7 9.5h5.3a2 2 0 0 1 2 2V20" />
      <path d="M3 20h18M7.5 8.5v.01M7.5 12v.01M7.5 15.5v.01M16 13v.01M16 16.5v.01" />
    </Base>
  )
}

export function IconMail(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="3" />
      <path d="m4 8 7.1 4.7a1.6 1.6 0 0 0 1.8 0L20 8" />
    </Base>
  )
}

export function IconPhone(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M7.4 3.5h2.1l1.4 3.6-1.8 1.3a12 12 0 0 0 5.5 5.5l1.3-1.8 3.6 1.4v2.1a2.4 2.4 0 0 1-2.6 2.4C10.6 17.4 6.6 13.4 5 6.1A2.4 2.4 0 0 1 7.4 3.5Z" />
    </Base>
  )
}

export function IconPin(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 21c4-4.4 6-7.7 6-10.5A6 6 0 0 0 6 10.5C6 13.3 8 16.6 12 21Z" />
      <circle cx="12" cy="10.3" r="2.3" />
    </Base>
  )
}

export function IconGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.4 3.3 5.2 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.2-3.3-8.5S9.8 5.9 12 3.5Z" />
    </Base>
  )
}

export function IconTarget(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.2" />
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

export function IconHelp(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9a2.8 2.8 0 0 1 5.4.9c0 1.8-2.4 2.1-2.7 3.6" />
      <circle cx="12" cy="16.8" r="0.15" fill="currentColor" />
    </Base>
  )
}

export function IconCheckCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.3 12.3 2.4 2.4 5-5.2" />
    </Base>
  )
}

export function IconInfo(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.15" fill="currentColor" />
    </Base>
  )
}
