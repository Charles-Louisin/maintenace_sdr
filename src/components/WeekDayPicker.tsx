import { ScrollView, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patch } from '../lib/api';
import { fmtWeek, isoToDate, weekDays } from '../lib/format';
import { Chip, H3, Small } from './ui';
import { space } from '../theme/tokens';

const DAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

/**
 * Salle « à la semaine » : jour des travaux donné par le responsable, ou report à un autre jour.
 * Seuls les jours de la semaine prévue sont proposés (jamais une autre semaine).
 * Sans jour : l'appel de suivi est relancé le dimanche soir ; avec un jour : le soir même.
 */
export function WeekDayPicker({
  eventId,
  date,
  plannedDay,
  title = 'Jour des travaux',
}: {
  eventId: string;
  date: string;
  plannedDay?: string | null;
  title?: string;
}) {
  const qc = useQueryClient();
  const set = useMutation({
    meta: { success: 'Jour des travaux enregistré · rappel de suivi recalculé' },
    mutationFn: (day: string | null) => patch(`/api/work-events/${eventId}/planned-day`, { plannedDay: day }),
    onSuccess: () => {
      for (const k of ['work-event', 'work-events', 'mission', 'missions', 'dashboard']) qc.invalidateQueries({ queryKey: [k] });
    },
  });
  const days = weekDays(date);
  return (
    <View style={{ gap: space.sm }}>
      <H3>{title}</H3>
      <Small>
        {fmtWeek(date)} · {plannedDay ? 'suivi relancé le soir du jour choisi' : 'pas encore connu : suivi relancé le dimanche soir'}
      </Small>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Chip label="Pas encore connu" active={!plannedDay} onPress={() => plannedDay && set.mutate(null)} />
        {days.map((d) => {
          const dt = isoToDate(d);
          return <Chip key={d} label={`${DAY[dt.getDay()]} ${dt.getDate()}`} active={plannedDay === d} onPress={() => plannedDay !== d && set.mutate(d)} />;
        })}
      </ScrollView>
    </View>
  );
}
