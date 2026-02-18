import React from 'react';
import { StyleProp, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { SoftInput } from './SoftInput';

interface SoftSearchInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
}

export const SoftSearchInput: React.FC<SoftSearchInputProps> = ({ containerStyle, ...props }) => {
  return (
    <SoftInput
      leftIcon="🔍"
      iconStyle={styles.searchIcon}
      returnKeyType="search"
      autoCorrect={false}
      autoCapitalize="none"
      placeholder="Buscar..."
      containerStyle={containerStyle}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  searchIcon: {
    fontSize: 20,
    lineHeight: 20,
    marginRight: 10,
    marginTop: -1,
  },
});
