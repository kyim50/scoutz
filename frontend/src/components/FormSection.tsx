import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

/**
 * The vertical rhythm shared by every create form.
 *
 * These four numbers are the only vertical gaps a form is allowed to express.
 * Previously each screen set `marginBottom` on its sections *and* on the
 * dividers between them, so the distance between any two things was the sum of
 * two unrelated values — 64pt in one place, 56pt in another, 32pt in a third,
 * with the hairline landing wherever that arithmetic happened to put it rather
 * than in the middle of the gap it was meant to divide.
 */
const RHYTHM = {
  /** A label to the control it names. Tight, so the pair reads as one unit. */
  labelToControl: 6,
  /** Between fields inside a group. No line — being in the same group is the relationship. */
  betweenFields: 20,
  /** Above and below a group divider. Symmetric, so a break reads as deliberate. */
  aroundDivider: 22,
  /** A group header to its first field. */
  headerToFirstField: 14,
};

interface FormFieldProps {
  /** Small caps label. Omit when the group title already names the control. */
  label?: string;
  /** One line under the label, for anything the label can't say in two words. */
  hint?: string;
  /** Rendered right-aligned on the label row — character counters, mostly. */
  accessory?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * One labelled control. Owns the label-to-control gap and nothing else — the
 * space *between* fields belongs to the group, so a field never has to know
 * what follows it.
 */
export function FormField({ label, hint, accessory, children, style }: FormFieldProps) {
  const { colors } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        labelRow: {
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: spacing.sm,
          marginBottom: RHYTHM.labelToControl,
        },
        label: {
          ...typography.bodySmallSemibold,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          // textSecondary rather than textMuted: at 11px, muted grey on the
          // dark surface falls under 4.5:1. The group title stays dominant
          // through size and weight instead of by washing this one out.
          color: colors.textSecondary,
          flexShrink: 1,
        },
        hint: {
          ...typography.caption,
          color: colors.textMuted,
          marginTop: -2,
          marginBottom: RHYTHM.labelToControl,
        },
      }),
    [colors]
  );

  return (
    <View style={style}>
      {label ? (
        <View style={s.labelRow}>
          <Text style={s.label}>{label}</Text>
          {accessory}
        </View>
      ) : null}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

interface FormGroupProps {
  title: string;
  /** Turns the space a header needs anyway into something that answers a question. */
  subtitle?: string;
  /** The first group on a screen: no divider above it. */
  first?: boolean;
  children: React.ReactNode;
}

/**
 * A titled run of related fields, preceded by a divider.
 *
 * Dividers appear only here, between groups. Putting one between every field —
 * as these forms used to — makes seven hairlines down a single screen, which
 * reads as a settings list rather than a form and leaves the page feeling like
 * mostly gaps. Fields that belong together are shown to belong together by
 * sitting closer, which costs no ink at all.
 */
export function FormGroup({ title, subtitle, first, children }: FormGroupProps) {
  const { colors } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        divider: {
          height: StyleSheet.hairlineWidth,
          // `border`, not `borderLight`: on the dark surface borderLight is six
          // values off the background, so the line was invisible and the gap
          // around it looked like a rendering fault rather than a separator.
          backgroundColor: colors.border,
          marginTop: RHYTHM.aroundDivider,
          marginBottom: RHYTHM.aroundDivider,
        },
        header: { marginBottom: RHYTHM.headerToFirstField, gap: 3 },
        title: {
          ...typography.bodySemibold,
          fontSize: 15,
          letterSpacing: -0.2,
          color: colors.text,
        },
        subtitle: { ...typography.caption, color: colors.textMuted },
        fields: { gap: RHYTHM.betweenFields },
      }),
    [colors]
  );

  return (
    <>
      {!first && <View style={s.divider} />}
      <View style={s.header}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={s.fields}>{children}</View>
    </>
  );
}

/** A standalone rule for the rare break that isn't a group boundary. */
export function FormDivider() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginTop: RHYTHM.aroundDivider,
        marginBottom: RHYTHM.aroundDivider,
      }}
    />
  );
}

export { RHYTHM };
