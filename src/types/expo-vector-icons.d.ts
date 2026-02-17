declare module '@expo/vector-icons' {
  import * as React from 'react';
  import { TextProps } from 'react-native';

  export interface MaterialCommunityIconsProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export const MaterialCommunityIcons: React.ComponentType<MaterialCommunityIconsProps>;
}
