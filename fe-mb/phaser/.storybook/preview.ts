import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'stone',
      values: [
        { name: 'stone', value: '#0a0a0f' },
        { name: 'parchment', value: '#1a1612' },
        { name: 'light', value: '#f5f0e8' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
