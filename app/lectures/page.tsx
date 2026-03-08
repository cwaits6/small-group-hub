import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayCircle } from "lucide-react";

export const metadata = { title: "Lectures | Incouragers" };

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/
  );
  return match ? match[1] : null;
}

export default async function LecturesPage() {
  const supabase = await createClient();

  const { data: lectures } = await supabase
    .from("lectures")
    .select("*")
    .order("lecture_date", { ascending: false });

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold text-amber-900 mb-2">
        Lectures & Lessons
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Watch or re-watch our recorded lessons.
      </p>

      {lectures && lectures.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lectures.map((lecture) => {
            const youtubeId = getYouTubeId(lecture.video_url);
            const thumbnail =
              lecture.thumbnail_url ||
              (youtubeId
                ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
                : null);

            return (
              <Card key={lecture.id} className="overflow-hidden hover:shadow-md transition-shadow">
                {youtubeId ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      title={lecture.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                ) : thumbnail ? (
                  <a
                    href={lecture.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video relative group"
                  >
                    <img
                      src={thumbnail}
                      alt={lecture.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayCircle className="h-16 w-16 text-white" />
                    </div>
                  </a>
                ) : (
                  <a
                    href={lecture.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video bg-amber-100 flex items-center justify-center"
                  >
                    <PlayCircle className="h-16 w-16 text-amber-700" />
                  </a>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{lecture.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {lecture.lecture_date && (
                    <p className="text-base text-muted-foreground mb-1">
                      {new Date(lecture.lecture_date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {lecture.description && (
                    <p className="text-base text-muted-foreground">{lecture.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-xl text-muted-foreground">No lectures available yet. Check back soon!</p>
      )}
    </div>
  );
}
