import { FlatList, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '../theme';

export interface OptionSheetItem<T extends string | number> {
  value: T;
  label: string;
}

export function OptionSheet<T extends string | number>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: OptionSheetItem<T>[];
  selected?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Pressable onPress={() => undefined}>
            <Text style={styles.title}>{title}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const active = item.value === selected;
                return (
                  <Pressable
                    style={[styles.row, active ? styles.rowActive : null]}
                    onPress={() => {
                      onSelect(item.value);
                      onClose();
                    }}
                  >
                    <Text style={[styles.rowLabel, active ? styles.rowLabelActive : null]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(28, 25, 23, 0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '70%',
    paddingTop: space[4],
    paddingHorizontal: space[4],
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: space[3],
  },
  row: {
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowActive: {
    backgroundColor: colors.primarySoft,
    marginHorizontal: -space[4],
    paddingHorizontal: space[4],
  },
  rowLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
  },
  rowLabelActive: {
    color: colors.primary,
  },
});
