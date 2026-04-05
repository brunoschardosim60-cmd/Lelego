import React from 'react';
import { View, TextInput, Text, StyleSheet, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface InputWithGhostProps {
  value: string;
  ghostText?: string;
  onChangeText: (text: string) => void;
  onGhostAccept?: () => void;
  placeholder?: string;
  label?: string;
  icon?: string;
  style?: any;
  [key: string]: any;
}

/**
 * Input que mostra sugestão "fantasma" por trás do texto digitado.
 * Pressionar Enter aceita a sugestão fantasma.
 */
export const InputWithGhost: React.FC<InputWithGhostProps> = ({
  value,
  ghostText,
  onChangeText,
  onGhostAccept,
  placeholder,
  label,
  icon,
  style,
  ...props
}) => {
  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Enter' && ghostText && ghostText.startsWith(value)) {
      // Enter pressionado e há ghost text disponível
      onGhostAccept?.();
    }
  };

  // Ghost text é apenas a parte que o usuário ainda não digitou
  const ghostSuffix = ghostText && ghostText.startsWith(value)
    ? ghostText.slice(value.length)
    : '';

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}
      
      <View style={styles.inputWrapper}>
        {/* Ghost text em background */}
        {ghostSuffix ? (
          <Text
            style={[
              styles.ghostText,
              style,
            ]}
          >
            {value}
            <Text style={styles.ghostSuffix}>{ghostSuffix}</Text>
          </Text>
        ) : null}

        <View style={styles.inputContainer}>
          {/* Icon se fornecido */}
          {icon ? (
            <Ionicons
              name={icon as any}
              size={20}
              color={COLORS.textSecondary}
              style={styles.icon}
            />
          ) : null}

          {/* Real input */}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textSecondary}
            style={[
              styles.input,
              icon && styles.inputWithIcon,
              style,
            ]}
            {...props}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  ghostText: {
    position: 'absolute',
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.regular,
  },
  ghostSuffix: {
    color: COLORS.textSecondary,
    opacity: 0.5,
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.regular,
  },
  inputWithIcon: {
    paddingHorizontal: 0,
  },
});
