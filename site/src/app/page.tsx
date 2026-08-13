import Experience from "@/components/Experience";
import SrOnlyArticle from "@/components/SrOnlyArticle";

/**
 * Server component. SrOnlyArticle renders the whole dictionary as HTML here, so
 * entries.json stays out of the client bundle and the content is reachable
 * without JavaScript or WebGL.
 */
export default function Page() {
  return (
    <>
      <a className="skip-link" href="#dictionary">
        Skip to the dictionary
      </a>
      <Experience />
      <SrOnlyArticle />
    </>
  );
}
