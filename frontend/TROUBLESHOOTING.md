# Frontend Troubleshooting Guide

## Common Issues and Solutions

### Blank White Page on Application Load

**Problem**: Application loads but shows only a blank white page

**Root Cause**: Node.js version incompatibility with Vite

**Error Message**:
```
You are using Node.js 18.20.8. Vite requires Node.js version 20.19+ or 22.12+. Please upgrade your Node.js version.
error when starting dev server:
TypeError: crypto.hash is not a function
```

**Solution**:
1. Check current Node.js version:
   ```bash
   node --version
   ```

2. Switch to compatible Node.js version using nvm:
   ```bash
   source ~/.nvm/nvm.sh
   nvm use 24.8.0  # or any version 20.19+ or 22.12+
   nvm alias default 24.8.0  # set as default
   ```

3. Restart the development server:
   ```bash
   npm run dev
   ```

**Prevention**:
- Keep Node.js version updated to meet Vite requirements
- Document Node.js version requirements in package.json engines field
- Use `.nvmrc` file to specify Node.js version for the project

### Required Node.js Versions
- **Vite 7.x**: Node.js 20.19+ or 22.12+
- **Recommended**: Node.js 24.8.0 (current stable)

### Development Server Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

**Fixed on**: 2025-09-13
**Status**: Resolved ✅
**Development Server**: Running on http://localhost:5174/