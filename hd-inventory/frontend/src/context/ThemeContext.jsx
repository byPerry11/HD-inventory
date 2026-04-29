import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('hd_theme') || 'dark')
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('hd_font_size')) || 14)

  useEffect(() => {
    localStorage.setItem('hd_theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('hd_font_size', fontSize)
    document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`)
    document.documentElement.style.fontSize = `${fontSize}px`
  }, [fontSize])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
