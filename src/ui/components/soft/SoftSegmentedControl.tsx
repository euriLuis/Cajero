import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

export function SoftSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.container}>
      {options.map(option => {
        const active = option === value;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.item, active && styles.active]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface2,
    padding: 4,
    gap: 6,
  },
  item: {
    flex: 1,
    borderRadius: theme.radius.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  active: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.softControlShadow,
  },
  label: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  labelActive: { color: theme.colors.text },
});
