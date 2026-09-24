// One stroke weight, one 20px grid. Paths only, so there is no icon library to ship.
const PATHS = {
  dashboard: 'M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z',
  list: 'M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01',
  user: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 17c.6-3 3.2-4.5 6.5-4.5s5.900 1.500 6.500 4.500',
  wrench: 'M12.500 3.500a3.500 3.500 0 0 0-3.200 4.800L3.500 14.100a1.400 1.400 0 0 0 2 2l5.800-5.800a3.500 3.500 0 0 0 4.800-3.200l-2.300 2.300-2-.6-.6-2z',
  inbox: 'M3 11l2-6h10l2 6M3 11v5h14v-5M3 11h4l1 2h4l1-2h4',
  chart: 'M4 16V9M10 16V4M16 16v-5',
  users: 'M7.500 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 16.500c.5-2.700 2.700-4 5.500-4s5 1.300 5.500 4M13.500 3.300a3 3 0 0 1 0 5.400M15 12.700c1.700.4 2.800 1.600 3 3.800',
  gear: 'M10 12.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5zM10 2v2M10 16v2M2 10h2M16 10h2M4.300 4.300l1.400 1.400M14.300 14.300l1.400 1.400M15.700 4.300l-1.400 1.400M5.700 14.300l-1.400 1.400',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM17 17l-3.700-3.700',
  plus: 'M10 4v12M4 10h12',
  bell: 'M5 8a5 5 0 0 1 10 0c0 4 1.500 5 1.500 5h-13S5 12 5 8zM8.500 16.500a1.700 1.700 0 0 0 3 0',
  menu: 'M3 5h14M3 10h14M3 15h14',
  logout: 'M8 3H4v14h4M12 6.500 15.500 10 12 13.500M15.500 10H7.500',
  chevron: 'M5 8l5 5 5-5',
  x: 'M5 5l10 10M15 5 5 15',
  sidebar: 'M3.500 4h13v12h-13zM8 4v12',
  arrow: 'M4 10h12M11 5l5 5-5 5',
}

export default function Icon({ name, size = 18 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
