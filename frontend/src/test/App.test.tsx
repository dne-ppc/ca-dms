import { describe, it, expect } from 'vitest'
import { render, screen } from './utils'
import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText('CA-DMS')).toBeInTheDocument()
  })

  it('redirects to dashboard by default', () => {
    render(<App />)
    expect(screen.getByText('CA-DMS Dashboard')).toBeInTheDocument()
  })
})
