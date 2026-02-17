import React from 'react';
import { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { SoftInput } from './SoftInput';

interface SoftSearchInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
}

export const SoftSearchInput: React.FC<SoftSearchInputProps> = ({ containerStyle, ...props }) => {
  return (
    <SoftInput
      leftIcon="⌕"
      returnKeyType="search"
      autoCorrect={false}
      autoCapitalize="none"
      placeholder="Buscar..."
      containerStyle={containerStyle}
      {...props}
    />
  );
};
