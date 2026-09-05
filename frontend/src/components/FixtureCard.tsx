"use client";

import { motion, type Variants } from "framer-motion";
import { MapPin, Clock, Shield, Calendar, Star, Sparkles } from "lucide-react";
import { Fixture } from "@/types/fixture";
import { getStatusBadge } from "@/lib/api";
import { formatSydneyTime, formatSydneyDate } from "@/lib/timezone";
import { Card, CardContent } from "./ui/Card";
import { cn } from "@/lib/utils";

interface FixtureCardProps {
  fixture: Fixture & { is_new?: boolean };
  onToggleFavourite: (fixtureId: number) => void;
  index: number;
  isFirstMount?: boolean;
  isNew?: boolean;
  onClearNewEvents?: () => void;
  isPast?: boolean;
}

const statusIcons = {
  upcoming: Calendar,
  live: Shield,
  completed: Star,
  cancelled: Star,
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

export function FixtureCard({ fixture, onToggleFavourite, index, isFirstMount = true, isNew, onClearNewEvents, isPast }: FixtureCardProps) {
  const StatusIcon = statusIcons[fixture.status] || Calendar;
  const { label, className: badgeClass } = getStatusBadge(fixture.status);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavourite(fixture.id);
    if (isNew && onClearNewEvents) {
      onClearNewEvents();
    }
  };

  return (
    <motion.article
      variants={cardVariants}
      initial={isFirstMount ? "hidden" : false}
      animate="visible"
      style={{ transitionDelay: `${(index % 10) * 50}ms` }}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:border-primary/20",
        fixture.is_favourite && "ring-1 ring-primary/30",
        isNew && "ring-2 ring-primary/50"
      )}
    >
      {isNew && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          NEW
        </motion.div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <Card className="relative h-full group">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                    badgeClass
                  )}
                >
                  <StatusIcon className="h-3 w-3" aria-hidden="true" />
                  {label}
                </span>

                {fixture.is_favourite && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                    <Star className="h-3 w-3 fill-yellow-500" aria-hidden="true" />
                    Favourite
                  </span>
                )}
              </div>

              <h3 className="text-lg font-semibold text-foreground truncate pr-8">
                {fixture.title}
              </h3>

              {fixture.opposition && (
                <p className="mt-1 text-sm text-muted-foreground font-medium">
                  vs {fixture.opposition}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                  <time dateTime={fixture.event_date}>
                    {formatSydneyDate(fixture.event_date)}
                  </time>
                </span>

                {fixture.event_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                    {formatSydneyTime(fixture.event_time)}
                  </span>
                )}

                {fixture.location && (
                  <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <MapPin className="h-3.5 w-3.5 opacity-60 flex-shrink-0" aria-hidden="true" />
                    {fixture.location}
                  </span>
                )}

                {fixture.sport && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {fixture.sport}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                className="relative p-1.5 rounded-full bg-muted hover:bg-accent transition-colors"
                onClick={handleToggle}
                aria-label={fixture.is_favourite ? "Remove from favourites" : "Add to favourites"}
                aria-pressed={fixture.is_favourite}
              >
                {fixture.is_favourite ? (
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                ) : (
                  <Star className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
                {fixture.is_favourite && (
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping">
                    <Star className="h-6 w-6 fill-yellow-400/30 text-yellow-400/30" aria-hidden="true" />
                  </span>
                )}
              </button>

              {fixture.team && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                  {fixture.team}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.article>
  );
}