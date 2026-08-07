# Cite - Frontend (React Native)

## ✨ Fully Implemented Features

### Screens
- ✅ **Onboarding** - Beautiful 3-slide introduction
- ✅ **Login** - Clean authentication UI
- ✅ **Signup** - Account creation with validation
- ✅ **Map** - Mapbox integration with dark theme, search, pins, and bottom sheets
- ✅ **Create Pin** - Full pin creation form with type selection, tags, and location
- ✅ **Profile** - User stats, settings, and logout

### Features
- ✅ **Natural Language Search** - AI-powered "What do you need?" search
- ✅ **Quick Actions** - Fast access to bathroom, food, pharmacy, events
- ✅ **Live Map** - Mapbox with custom pins and user location
- ✅ **Pin Creation** - Complete form with all fields
- ✅ **Auth Flow** - Login, signup, JWT token management
- ✅ **Bottom Sheets** - Pin details on tap
- ✅ **Dark Theme** - Modern dark UI matching your reference

### Design
- ✅ Clean, modern aesthetic
- ✅ Dark theme optimized for maps
- ✅ Smooth animations
- ✅ Responsive layouts
- ✅ Custom icons and markers

## 🎨 UI Theme

The app uses a dark theme with:
- **Primary Color:** Indigo (#6366F1)
- **Background:** Dark blue-gray (#0F172A)
- **Surface:** Lighter gray (#1E293B)
- **Map Style:** Mapbox dark-v11

Matches the aesthetic from your reference images!

## Development

### Adding New Screens

1. Create screen component in `src/screens/`
2. Add route in `src/navigation/AppNavigator.tsx`
3. Update types if needed

### API Integration

API client is in `src/services/api.ts`. Add new endpoints there.

Example:
```typescript
export const createPin = async (data: CreatePinData) => {
  const response = await api.post('/pins', data);
  return response.data;
};
```

### State Management

Using Zustand for global state and React Query for server state.

## Building for Production

### iOS
```bash
eas build --platform ios
```

### Android
```bash
eas build --platform android
```

## Common Issues

### "Cannot connect to server"
- Check API_URL in .env
- Use local IP, not localhost
- Ensure backend is running
- Check same WiFi network

### "Map not loading"
- Verify MAPBOX_TOKEN in .env
- Check token permissions
- Clear Metro bundler cache: `expo start -c`

### "Location permission denied"
- Check app.json permissions
- Reset simulator/emulator
- Check device settings

## Testing

```bash
npm test
```

## Next Steps

1. Customize theme in `src/constants/theme.ts`
2. Add your app icons and splash screen
3. Configure push notifications
4. Set up analytics
5. Test on physical devices

## Need Help?

Refer to:
- Main documentation in `/docs`
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
