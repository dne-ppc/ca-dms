/**
 * Simple IntroPage Test Component
 */
import React from 'react'

export const IntroPageTest: React.FC = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: 'white', color: 'black' }}>
      <h1>IntroPage Test</h1>
      <p>This is a simple test to verify the page can render without imports issues.</p>
      <p>If you can see this, the basic React component rendering is working.</p>
    </div>
  )
}