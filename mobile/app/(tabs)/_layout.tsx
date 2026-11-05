import { Tabs } from 'expo-router';
import { IconContexts, IconHome, IconStats, IconTasks } from '@ui/components/icons';
import { colors, fonts } from '@ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.borderNav,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <IconHome
              color={focused ? colors.primary : colors.textMuted}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="contexts"
        options={{
          title: 'Contexts',
          tabBarIcon: ({ focused }) => (
            <IconContexts
              color={focused ? colors.primary : colors.textMuted}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ focused }) => (
            <IconTasks
              color={focused ? colors.primary : colors.textMuted}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => (
            <IconStats
              color={focused ? colors.primary : colors.textMuted}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
