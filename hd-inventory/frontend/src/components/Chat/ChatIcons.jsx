// Set de iconos del chat — HD-Inventory.
// Todos son SVG de trazo (sin emojis). Un mismo grosor y rejilla de 24px
// para que botones, lista y sala se vean coherentes.

function Base({ size = 20, children, filled = false, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const SendIcon = ({ size = 20 }) => (
  <Base size={size}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </Base>
)

export const AttachIcon = ({ size = 20 }) => (
  <Base size={size}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Base>
)

export const ChatBubbleIcon = ({ size = 28 }) => (
  <Base size={size}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Base>
)

export const SearchIcon = ({ size = 18 }) => (
  <Base size={size}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Base>
)

export const GroupIcon = ({ size = 20 }) => (
  <Base size={size}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Base>
)

export const DirectIcon = ({ size = 14 }) => (
  <Base size={size}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Base>
)

export const PinIcon = ({ size = 16, filled = false }) => (
  <Base size={size} filled={filled}>
    {filled ? (
      <path d="M9 4h6a1 1 0 0 1 1 1v5l3 4v2H5v-2l3-4V5a1 1 0 0 1 1-1zm3 12v5" stroke="none" />
    ) : (
      <>
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14v-2l-3-3V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v7l-3 3v2z" />
      </>
    )}
  </Base>
)

export const DeleteIcon = ({ size = 16 }) => (
  <Base size={size}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </Base>
)

export const BackIcon = ({ size = 20 }) => (
  <Base size={size}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </Base>
)

export const CloseIcon = ({ size = 20 }) => (
  <Base size={size}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Base>
)

export const FileIcon = ({ size = 18 }) => (
  <Base size={size}>
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </Base>
)

export const ImageIcon = ({ size = 14 }) => (
  <Base size={size}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </Base>
)

export const CheckIcon = ({ size = 16 }) => (
  <Base size={size}>
    <polyline points="20 6 9 17 4 12" />
  </Base>
)

// Doble check: mensaje leído / confirmado
export const CheckDoubleIcon = ({ size = 14 }) => (
  <Base size={size}>
    <polyline points="18 6 7 17 2 12" />
    <polyline points="22 10 13 21 11 19" />
  </Base>
)

// Sobre con punto: conversación sin leer
export const UnreadIcon = ({ size = 12 }) => (
  <Base size={size} filled>
    <path
      stroke="none"
      d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5zm2.3.5L12 12l7.7-6.5H4.3zM20 7.2l-8 6.8-8-6.8V19h16V7.2z"
    />
  </Base>
)

export const PlusIcon = ({ size = 18 }) => (
  <Base size={size} strokeWidth={2}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Base>
)

export const RetryIcon = ({ size = 12 }) => (
  <Base size={size}>
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </Base>
)

// Rayo: inserciones rápidas operativas (reemplaza al botón de emojis)
export const QuickIcon = ({ size = 20 }) => (
  <Base size={size}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Base>
)

export const BoxIcon = ({ size = 18 }) => (
  <Base size={size}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </Base>
)

export const TruckIcon = ({ size = 18 }) => (
  <Base size={size}>
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </Base>
)

export const AlertIcon = ({ size = 18 }) => (
  <Base size={size}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Base>
)

export const BellIcon = ({ size = 20 }) => (
  <Base size={size}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Base>
)

export const BellOffIcon = ({ size = 20 }) => (
  <Base size={size}>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
    <path d="M18 8a6 6 0 0 0-9.33-5" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </Base>
)

export const SpinnerIcon = ({ size = 20 }) => (
  <svg
    className="spinner-icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)
