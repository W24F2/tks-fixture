"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Heart, MapPin, Clock, Shield, Calendar, Star } from "lucide-react";
import { Fixture } from "@/types/fixture";
import { formatTime, getStatusBadge } from "@/lib/api";
import { Card, CardContent } from "./ui/Card";
import { cn } from "@/lib/utils";

interface FixtureCardProps {
  fixture: Fixture;
  onToggleFavourite: (fixtureId: number, isFavourite: boolean) => void;
  index: number;
}

const statusIcons = {
  upcoming: Calendar,
  live: Shield,
  completed: Star,
  cancelled: Star,
};

export function FixtureCard({ fixture, onToggleFavourite, index }: FixtureCardProps) {
  const StatusIcon = statusIcons[fixture.status] || Calendar;
  const { label, className: badgeClass } = getStatusBadge(fixture.status);

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

  return (
    <motion.article
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:border-primary/20",
        fixture.is_favourite && "ring-1 ring-primary/30"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <Card className="relative h-full group">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * (index % 5) + 0.1, type: "spring", stiffness: 300 }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                    badgeClass
                  )}
                >
                  <StatusIcon className="h-3 w-3" aria-hidden="true" />
                  {label}
                </motion.span>

                <AnimatePresence mode="wait">
                  {fixture.is_favourite && (
                    <motion.span
                      key="favourite-badge"
                      initial={{ opacity: 0, scale: 0.5, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.5, x: 10 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    >
                      <Star className="h-3 w-3 fill-yellow-500" aria-hidden="true" />
                      Favourite
                    </motion.span>
                  )}
                </AnimatePresence>
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
                    {new Date(fixture.event_date).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </span>

                {fixture.event_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                    {formatTime(fixture.event_time)}
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
              <motion.button
                className="relative p-1.5 rounded-full bg-muted hover:bg-accent transition-colors group/fav"
                onClick={() => onToggleFavourite(fixture.id, !fixture.is_favourite)}
                aria-label={fixture.is_favourite ? "Remove from favourites" : "Add to favourites"}
                aria-pressed={fixture.is_favourite}
                whileTap={{ scale: 0.85 }}
              >
                <AnimatePresence mode="wait">
                  {!fixture.is_favourite ? (
                    <motion.span
                      key="empty-heart"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 20 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <Heart className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="filled-heart"
                      initial={{ scale: 0, rotate: 20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: -20 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <Heart className="h-5 w-5 fill-red-500 text-red-500" aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {fixture.is_favourite && (
                    <motion.div
                      key="heart-burst"
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <Heart className="h-6 w-6 fill-red-500/30 text-red-500/30" aria-hidden="true" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

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