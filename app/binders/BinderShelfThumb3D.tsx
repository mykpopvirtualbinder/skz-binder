"use client";

import Binder3DBook from "./Binder3DBook";

type BinderShelfThumb3DProps = {
  title: string;
  color: string;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  onOpenBinder: () => void;
  tourId?: string;
  t: (key: string) => string;
};

export default function BinderShelfThumb3D(props: BinderShelfThumb3DProps) {
  return (
    <Binder3DBook
      title={props.title}
      color={props.color}
      coverUrl={props.coverUrl}
      backCoverUrl={props.backCoverUrl}
      width={118}
      height={164}
      depth={38}
      onOpenBinder={props.onOpenBinder}
      tourId={props.tourId}
      t={props.t}
      showHint
    />
  );
}
